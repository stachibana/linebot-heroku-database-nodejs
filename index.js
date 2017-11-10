'use strict';

const line = require('@line/bot-sdk');
const express = require('express');

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result));
});

// event handler
function handleEvent(event) {
  if (event.type === 'message' || event.message.type === 'text') {
    if(event.message.text === 'last') {
      const connection = getDBConnection();
      connection.query('select lastmessage from users where $1 = userid', [event.source.userId], function(err, res) {
        if(err) {
          console.error('could not connect to postgres', err);
        }
        let row = res.rows[0];
        const array = [{
          type: 'text',
          text: row['lastmessage']
        }];
        return client.replyMessage(event.replyToken, array);
        client.end();
      });
    } else {
      const connection = getDBConnection();
      connection.query('insert into users (userid, lastmessage) values($1, $2) on conflict on constraint users_pkey do update set lastmessage = $3',
        [event.source.userId, event.message.text, event.message.text], function(err, res) {
          const array = [{
            type: 'text',
            text: 'Message saved. Send \'last\' to show.'
          }];
          return client.replyMessage(event.replyToken, array);
          client.end();
        });
    }
  }
}

function getDBConnection() {
  const { Client } = require('pg');
  const connection = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  });
  connection.connect();
  return connection;
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
