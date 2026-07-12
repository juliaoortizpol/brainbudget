const fs = require('fs');

const data = fs.readFileSync('BrainBudget.postman_collection.json', 'utf8');
const collection = JSON.parse(data);

const categoriesFolder = {
  name: 'Categories',
  item: [
    {
      name: 'Create Category',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "name": "Groceries",\n    "type": "expense",\n    "icon": "cart",\n    "color": "#ff0000"\n}',
        },
        url: {
          raw: '{{base_url}}/categories',
          host: ['{{base_url}}'],
          path: ['categories'],
        },
      },
    },
    {
      name: 'Get Categories',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/categories',
          host: ['{{base_url}}'],
          path: ['categories'],
        },
      },
    },
    {
      name: 'Get Category by ID',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/categories/YOUR_CATEGORY_ID',
          host: ['{{base_url}}'],
          path: ['categories', 'YOUR_CATEGORY_ID'],
        },
      },
    },
    {
      name: 'Update Category',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "name": "Supermarket Groceries"\n}',
        },
        url: {
          raw: '{{base_url}}/categories/YOUR_CATEGORY_ID',
          host: ['{{base_url}}'],
          path: ['categories', 'YOUR_CATEGORY_ID'],
        },
      },
    },
    {
      name: 'Delete Category',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/categories/YOUR_CATEGORY_ID',
          host: ['{{base_url}}'],
          path: ['categories', 'YOUR_CATEGORY_ID'],
        },
      },
    },
  ],
};

const budgetsFolder = {
  name: 'Budgets',
  item: [
    {
      name: 'Create Budget',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "name": "May 2026 Budget",\n    "periodType": "monthly",\n    "startDate": "2026-05-01T00:00:00Z",\n    "endDate": "2026-05-31T23:59:59Z",\n    "status": "active",\n    "items": [\n        {\n            "name": "Groceries",\n            "type": "expense",\n            "plannedAmount": 500\n        }\n    ]\n}',
        },
        url: {
          raw: '{{base_url}}/budgets',
          host: ['{{base_url}}'],
          path: ['budgets'],
        },
      },
    },
    {
      name: 'Get Budgets',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/budgets',
          host: ['{{base_url}}'],
          path: ['budgets'],
        },
      },
    },
    {
      name: 'Get Budget by ID',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/budgets/YOUR_BUDGET_ID',
          host: ['{{base_url}}'],
          path: ['budgets', 'YOUR_BUDGET_ID'],
        },
      },
    },
    {
      name: 'Update Budget',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "name": "Updated May Budget"\n}',
        },
        url: {
          raw: '{{base_url}}/budgets/YOUR_BUDGET_ID',
          host: ['{{base_url}}'],
          path: ['budgets', 'YOUR_BUDGET_ID'],
        },
      },
    },
    {
      name: 'Delete Budget',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/budgets/YOUR_BUDGET_ID',
          host: ['{{base_url}}'],
          path: ['budgets', 'YOUR_BUDGET_ID'],
        },
      },
    },
    {
      name: 'Add Budget Item',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "name": "Rent",\n    "description": "Monthly apartment rent",\n    "type": "expense",\n    "icon": "home",\n    "color": "#4f46e5",\n    "plannedAmount": 1200\n}',
        },
        url: {
          raw: '{{base_url}}/budgets/YOUR_BUDGET_ID/items',
          host: ['{{base_url}}'],
          path: ['budgets', 'YOUR_BUDGET_ID', 'items'],
        },
      },
    },
    {
      name: 'Delete Budget Item',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/budgets/YOUR_BUDGET_ID/items/YOUR_ITEM_ID',
          host: ['{{base_url}}'],
          path: ['budgets', 'YOUR_BUDGET_ID', 'items', 'YOUR_ITEM_ID'],
        },
      },
    },
    {
      name: 'Update Budget Item',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "plannedAmount": 250,\n    "alertEnabled": true\n}',
        },
        url: {
          raw: '{{base_url}}/budgets/YOUR_BUDGET_ID/items/YOUR_ITEM_ID',
          host: ['{{base_url}}'],
          path: ['budgets', 'YOUR_BUDGET_ID', 'items', 'YOUR_ITEM_ID'],
        },
      },
    },
  ],
};

const categoriesIndex = collection.item.findIndex(
  (i) => i.name === 'Categories',
);
if (categoriesIndex !== -1) {
  collection.item[categoriesIndex] = categoriesFolder;
} else {
  collection.item.push(categoriesFolder);
}

const budgetsIndex = collection.item.findIndex((i) => i.name === 'Budgets');
if (budgetsIndex !== -1) {
  collection.item[budgetsIndex] = budgetsFolder;
} else {
  collection.item.push(budgetsFolder);
}

const transactionsFolder = {
  name: 'Transactions',
  item: [
    {
      name: 'Create Transaction',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "budgetItemId": "YOUR_BUDGET_ITEM_ID",\n    "name": "Grocery Shopping",\n    "amount": 150.50,\n    "type": "expense",\n    "date": "2026-05-17T10:00:00Z",\n    "notes": "Bought groceries at the local supermarket"\n}',
        },
        url: {
          raw: '{{base_url}}/transactions',
          host: ['{{base_url}}'],
          path: ['transactions'],
        },
      },
    },
    {
      name: 'Get Transactions',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/transactions?page=1&limit=10',
          host: ['{{base_url}}'],
          path: ['transactions'],
          query: [
            { key: 'page', value: '1' },
            { key: 'limit', value: '10' },
          ],
        },
      },
    },
    {
      name: 'Get Transaction by ID',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/transactions/YOUR_TRANSACTION_ID',
          host: ['{{base_url}}'],
          path: ['transactions', 'YOUR_TRANSACTION_ID'],
        },
      },
    },
    {
      name: 'Update Transaction',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: '{\n    "amount": 160.00,\n    "notes": "Updated price"\n}',
        },
        url: {
          raw: '{{base_url}}/transactions/YOUR_TRANSACTION_ID',
          host: ['{{base_url}}'],
          path: ['transactions', 'YOUR_TRANSACTION_ID'],
        },
      },
    },
    {
      name: 'Delete Transaction',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/transactions/YOUR_TRANSACTION_ID',
          host: ['{{base_url}}'],
          path: ['transactions', 'YOUR_TRANSACTION_ID'],
        },
      },
    },
  ],
};

const transactionsIndex = collection.item.findIndex(
  (i) => i.name === 'Transactions',
);
if (transactionsIndex !== -1) {
  collection.item[transactionsIndex] = transactionsFolder;
} else {
  collection.item.push(transactionsFolder);
}

const gmailReaderFolder = {
  name: 'Gmail Reader',
  description:
    'Connect Gmail and read normalized messages. Complete Google consent by opening the URL returned by the first request in a browser.',
  item: [
    {
      name: '1. Get Gmail Authorization URL',
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              "if (response.url) pm.collectionVariables.set('gmail_auth_url', response.url);",
            ],
          },
        },
      ],
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/gmail-reader/auth-url',
          host: ['{{base_url}}'],
          path: ['gmail-reader', 'auth-url'],
        },
        description:
          'After sending this request, open the returned URL (or {{gmail_auth_url}}) in a browser and complete Google consent. Google redirects to /gmail-reader/oauth/callback.',
      },
    },
    {
      name: '2. Get Gmail Connection Status',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/gmail-reader/status',
          host: ['{{base_url}}'],
          path: ['gmail-reader', 'status'],
        },
      },
    },
    {
      name: '3. List Recent Gmail Messages',
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              "if (response.messages?.length) pm.collectionVariables.set('gmail_message_id', response.messages[0].id);",
              "if (response.nextPageToken) pm.collectionVariables.set('gmail_page_token', response.nextPageToken);",
            ],
          },
        },
      ],
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/gmail-reader/messages?query=newer_than%3A7d&maxResults=10&includeBody=true',
          host: ['{{base_url}}'],
          path: ['gmail-reader', 'messages'],
          query: [
            { key: 'query', value: 'newer_than:7d' },
            { key: 'maxResults', value: '10' },
            { key: 'includeBody', value: 'true' },
          ],
        },
      },
    },
    {
      name: '4. List Next Gmail Page',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/gmail-reader/messages?query=newer_than%3A30d&maxResults=5&includeBody=false&pageToken={{gmail_page_token}}',
          host: ['{{base_url}}'],
          path: ['gmail-reader', 'messages'],
          query: [
            { key: 'query', value: 'newer_than:30d' },
            { key: 'maxResults', value: '5' },
            { key: 'includeBody', value: 'false' },
            { key: 'pageToken', value: '{{gmail_page_token}}' },
          ],
        },
        description:
          'Run List Recent Gmail Messages first so gmail_page_token is populated.',
      },
    },
    {
      name: '5. Get One Gmail Message',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/gmail-reader/messages/{{gmail_message_id}}',
          host: ['{{base_url}}'],
          path: ['gmail-reader', 'messages', '{{gmail_message_id}}'],
        },
        description:
          'Run List Recent Gmail Messages first so gmail_message_id is populated.',
      },
    },
    {
      name: '6. Disconnect Gmail',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/gmail-reader/connection',
          host: ['{{base_url}}'],
          path: ['gmail-reader', 'connection'],
        },
      },
    },
  ],
};

const gmailReaderIndex = collection.item.findIndex(
  (i) => i.name === 'Gmail Reader',
);
if (gmailReaderIndex !== -1) {
  collection.item[gmailReaderIndex] = gmailReaderFolder;
} else {
  collection.item.push(gmailReaderFolder);
}

const gmailReaderVariables = [
  'gmail_auth_url',
  'gmail_message_id',
  'gmail_page_token',
];
for (const key of gmailReaderVariables) {
  if (!collection.variable.some((variable) => variable.key === key)) {
    collection.variable.push({ key, value: '', type: 'string' });
  }
}

const institutionsFolder = {
  name: 'Institutions',
  description:
    'Authenticated users can read enabled institutions. Creating, editing, listing disabled entries, and disabling institutions require an admin JWT.',
  item: [
    {
      name: '1. List Available Institutions',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/institutions',
          host: ['{{base_url}}'],
          path: ['institutions'],
        },
      },
    },
    {
      name: '2. Admin - Create Institution',
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              "if (response._id) pm.collectionVariables.set('institution_id', response._id);",
            ],
          },
        },
      ],
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            {
              name: 'Banreservas',
              slug: 'banreservas',
              aliases: ['Banco de Reservas'],
              supportedAccountTypes: ['credit_card'],
              emailRules: [
                {
                  senderAddresses: ['notificaciones@banreservas.com'],
                  subjectKeywords: ['Notificación de Consumo', 'Consumo'],
                  parserKey: 'banreservas.credit-card',
                  parserVersion: 1,
                  accountType: 'credit_card',
                  enabled: true,
                },
              ],
              enabled: true,
            },
            null,
            2,
          ),
        },
        url: {
          raw: '{{base_url}}/admin/institutions',
          host: ['{{base_url}}'],
          path: ['admin', 'institutions'],
        },
      },
    },
    {
      name: '3. Admin - List All Institutions',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/admin/institutions',
          host: ['{{base_url}}'],
          path: ['admin', 'institutions'],
        },
      },
    },
    {
      name: '4. Get Institution',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/institutions/{{institution_id}}',
          host: ['{{base_url}}'],
          path: ['institutions', '{{institution_id}}'],
        },
      },
    },
    {
      name: '5. Admin - Update Institution',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            { aliases: ['Banco de Reservas', 'Banreservas RD'] },
            null,
            2,
          ),
        },
        url: {
          raw: '{{base_url}}/admin/institutions/{{institution_id}}',
          host: ['{{base_url}}'],
          path: ['admin', 'institutions', '{{institution_id}}'],
        },
      },
    },
    {
      name: '6. Admin - Disable Institution',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/admin/institutions/{{institution_id}}',
          host: ['{{base_url}}'],
          path: ['admin', 'institutions', '{{institution_id}}'],
        },
      },
    },
  ],
};

const institutionsIndex = collection.item.findIndex(
  (item) => item.name === 'Institutions',
);
if (institutionsIndex !== -1) {
  collection.item[institutionsIndex] = institutionsFolder;
} else {
  collection.item.push(institutionsFolder);
}
if (
  !collection.variable.some((variable) => variable.key === 'institution_id')
) {
  collection.variable.push({
    key: 'institution_id',
    value: '',
    type: 'string',
  });
}

const accountsFolder = {
  name: 'Accounts',
  description:
    'Use institutionId for a registered institution, or institution for a custom bank.',
  item: [
    {
      name: '1. Create Account With Registered Institution',
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              "if (response._id) pm.collectionVariables.set('account_id', response._id);",
            ],
          },
        },
      ],
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            {
              name: 'My Banreservas Card',
              institutionId: '{{institution_id}}',
              type: 'credit_card',
              last4Digits: '4134',
              status: 'active',
            },
            null,
            2,
          ),
        },
        url: {
          raw: '{{base_url}}/accounts',
          host: ['{{base_url}}'],
          path: ['accounts'],
        },
        description:
          'Create an institution first so institution_id is populated.',
      },
    },
    {
      name: '2. Create Account With Custom Bank',
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              "if (response._id) pm.collectionVariables.set('account_id', response._id);",
            ],
          },
        },
      ],
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            {
              name: 'Community Savings',
              institution: 'Community Bank',
              type: 'savings',
              status: 'active',
            },
            null,
            2,
          ),
        },
        url: {
          raw: '{{base_url}}/accounts',
          host: ['{{base_url}}'],
          path: ['accounts'],
        },
      },
    },
    {
      name: '3. List Accounts',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{jwt_token}}' }],
        url: {
          raw: '{{base_url}}/accounts',
          host: ['{{base_url}}'],
          path: ['accounts'],
        },
      },
    },
    {
      name: '4. Change Account To Custom Bank',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{jwt_token}}' },
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            {
              institutionId: null,
              institution: 'Community Bank',
            },
            null,
            2,
          ),
        },
        url: {
          raw: '{{base_url}}/accounts/{{account_id}}',
          host: ['{{base_url}}'],
          path: ['accounts', '{{account_id}}'],
        },
      },
    },
  ],
};

const accountsIndex = collection.item.findIndex(
  (item) => item.name === 'Accounts',
);
if (accountsIndex !== -1) {
  collection.item[accountsIndex] = accountsFolder;
} else {
  collection.item.push(accountsFolder);
}
if (!collection.variable.some((variable) => variable.key === 'account_id')) {
  collection.variable.push({ key: 'account_id', value: '', type: 'string' });
}

fs.writeFileSync(
  'BrainBudget.postman_collection.json',
  JSON.stringify(collection, null, 2),
);
console.log('Postman collection updated!');
