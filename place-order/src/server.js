const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const PLACE_ORDER = `mutation placeOrder($order_id: uuid, $city: String!, $country: String!, $house_number: Int!, $street_name: String!, $zip_code: String!, $ordered: Boolean!, $total: numeric) {
  update_order(where: {id: {_eq: $order_id}}, _set: {city: $city, country: $country, house_number: $house_number, ordered: $ordered, street_name: $street_name, zip_code: $zip_code, total: $total}) {
      returning {
        id
        ordered
        total
    }
  }
}`;

const LATEST_USER_ORDER = `query getUserOrder($user_id: uuid) {
  users(where: {id: {_eq: $user_id}}) {
    orders(order_by: {created_at: desc}) {
      created_at
      id
      ordered
      order_items {
        id
        product {
          name
          price
        }
        quantity
      }
      total
    }
  }
}
`;

const execute = async (variables, operation, reqHeaders) => {
  const fetchResponse = await fetch(
    "<your_GraphQL_endpoint",
    {
      method: 'POST',
      headers: {
        ...reqHeaders,
        'x-hasura-access-key': process.env.HASURA_GRAPHQL_ADMIN_SECRET
      } || {},
      body: JSON.stringify({
        query: operation,
        variables
      })
    }
  );

  const data = await fetchResponse.json();
  return data;
};

app.post('/placeOrder', async (req, res) => {
  // get request input
  const { city, country, house_number, street_name, zip_code, ordered } = req.body.input;
  const user_id = req.body.session_variables['x-hasura-user-id'];

  // check if the user has any orders
  const { data: orderExists, errors: orderExistsErr } = await execute({ user_id }, LATEST_USER_ORDER, req.body.session_variables);

  if (orderExistsErr) {
    return res.status(400).json({ error: orderExistsErr[0].message });
  }

  if (orderExists.users[0].orders[0].ordered === true) {
    return res.status(400).json({ error: 'Start an order before trying to place one!' });
  }

  const order_id = orderExists.users[0].orders[0].id;

  const orderItemsTotal = orderExists.users[0].orders[0].order_items.map(orderItem => {
    const total = orderItem.product.price * orderItem.quantity;
    return total;
  });

  const amountToPay = orderItemsTotal.reduce((acc, curr) => acc + curr, 0);

  const { data: placeOrder, errors: placeOrderErr } = await execute({ order_id, city, country, house_number, street_name, zip_code, ordered, total: amountToPay }, PLACE_ORDER, req.body.session_variables);

  if (placeOrderErr) {
    return res.status(400).json({ error: placeOrderErr[0].message });
  }
  
  return res.json({
    ...placeOrder.update_order.returning[0]
  });
});

app.listen(PORT);
