const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const bcrypt = require("bcrypt");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const REGISTRATION = `
mutation ($name: String!, $username: String!, $email: String!, $password: String!) {
  insert_users_one(
    object: {
      name: $name,
      username: $username,
      email: $email,
      password: $password
    }
  ) { id }
}
`;

const execute = async (variables, reqHeaders) => {
  const fetchResponse = await fetch(
    "<your_GraphQL_endpoint",
    {
      method: 'POST',
      headers: {
        ...reqHeaders,
        'x-hasura-access-key': process.env.HASURA_GRAPHQL_ADMIN_SECRET
      } || {},
      body: JSON.stringify({
        query: REGISTRATION,
        variables
      })
    }
  );
  const data = await fetchResponse.json();
  return data;
};
  

// Request Handler
app.post('/register', async (req, res) => {

  // get request input
  const { name, username, email, password } = req.body.input;

  // encrypt the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  const { data, errors } = await execute({ name, username, email, password: hashedPassword });

  if (errors) {
    return res.status(400).json(errors[0])
  }

  return res.json({
    ...data.insert_users_one
  });
});

app.listen(PORT);
