const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const CREATE_ORDER_ITEM = `
mutation createOrderItem($product_id: uuid, $quantity: Int!, $order_id: uuid) {
  insert_order_item_one(object: {
    product_id: $product_id,
    quantity: $quantity,
    order_id: $order_id
  }) {
    id
  }
}`;

const USER_ORDER_EXISTS = `query getUserOrder($user_id: uuid) {
  users(where: {id: {_eq: $user_id}}) {
    orders(order_by: {created_at: desc}) {
      created_at
      id
      ordered
    }
  }
}`;

const CREATE_USER_ORDER = `mutation createUserOrder($city: String!, $country: String!, $house_number: Int!, $street_name: String!, $user_id: uuid, $zip_code: String!, $total: numeric) {
  insert_order(
    objects: {
      city: $city,
      country: $country,	
      house_number: $house_number,
      street_name: $street_name,	
      user_id: $user_id,	
      zip_code: $zip_code,
      total: $total
    }
  ) {
    returning {
      id
    }
    affected_rows
  }
}`;

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

app.post('/createOrderItem', async (req, res) => {
  const { product_id, quantity } = req.body.input;
  const user_id = req.body.session_variables['x-hasura-user-id'];
  let latest_order = '';

  // check if the user has any orders
  const { data: orderExists, errors: orderExistsErr } = await execute({ user_id }, USER_ORDER_EXISTS, req.body.session_variables);

  if (orderExistsErr) {
    return res.status(400).json({ error: orderExistsErr[0].message });
  }

  // if the user doesn't have any orders or the latest order is ordered 
  //   create a new order and store its ID in "latest_order"
  // otherwise, store the ID of the latest order in "latest_order"
  if (orderExists.users[0].orders.length === 0 || orderExists.users[0].orders[0].ordered === true) {
    const { data: createOrder, errors: createOrderErr } = await execute({ city: '', country: '', house_number: 0, street_name: '', user_id, zip_code: '', total: 0}, CREATE_USER_ORDER, req.body.session_variables);
    
    if (createOrderErr) {
      return res.status(400).json({ error: createOrderErr[0].message });
    }

    latest_order = createOrder.insert_order.returning[0].id;
  } else {
    latest_order = orderExists.users[0].orders[0].id;
  }

  // create the order item and add it to the order
  const { data: createOrder, errors: createOrderErr } = await execute({ product_id, quantity, order_id: latest_order }, CREATE_ORDER_ITEM, req.body.session_variables);

  if (createOrderErr) {
    return res.status(400).json({ error: createOrderErr[0].message});
  }

  // success
  return res.json({
    ...createOrder.insert_order_item_one
  });
});

app.listen(PORT);
