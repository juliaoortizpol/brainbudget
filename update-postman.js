const fs = require('fs');

const data = fs.readFileSync('BrainBudget.postman_collection.json', 'utf8');
const collection = JSON.parse(data);

const categoriesFolder = {
  "name": "Categories",
  "item": [
    {
      "name": "Create Category",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"name\": \"Groceries\",\n    \"type\": \"expense\",\n    \"icon\": \"cart\",\n    \"color\": \"#ff0000\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/categories",
          "host": ["{{base_url}}"],
          "path": ["categories"]
        }
      }
    },
    {
      "name": "Get Categories",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/categories",
          "host": ["{{base_url}}"],
          "path": ["categories"]
        }
      }
    },
    {
      "name": "Get Category by ID",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/categories/YOUR_CATEGORY_ID",
          "host": ["{{base_url}}"],
          "path": ["categories", "YOUR_CATEGORY_ID"]
        }
      }
    },
    {
      "name": "Update Category",
      "request": {
        "method": "PATCH",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"name\": \"Supermarket Groceries\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/categories/YOUR_CATEGORY_ID",
          "host": ["{{base_url}}"],
          "path": ["categories", "YOUR_CATEGORY_ID"]
        }
      }
    },
    {
      "name": "Delete Category",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/categories/YOUR_CATEGORY_ID",
          "host": ["{{base_url}}"],
          "path": ["categories", "YOUR_CATEGORY_ID"]
        }
      }
    }
  ]
};

const budgetsFolder = {
  "name": "Budgets",
  "item": [
    {
      "name": "Create Budget",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"name\": \"May 2026 Budget\",\n    \"periodType\": \"monthly\",\n    \"startDate\": \"2026-05-01T00:00:00Z\",\n    \"endDate\": \"2026-05-31T23:59:59Z\",\n    \"status\": \"active\",\n    \"items\": [\n        {\n            \"name\": \"Groceries\",\n            \"type\": \"expense\",\n            \"plannedAmount\": 500\n        }\n    ]\n}"
        },
        "url": {
          "raw": "{{base_url}}/budgets",
          "host": ["{{base_url}}"],
          "path": ["budgets"]
        }
      }
    },
    {
      "name": "Get Budgets",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/budgets",
          "host": ["{{base_url}}"],
          "path": ["budgets"]
        }
      }
    },
    {
      "name": "Get Budget by ID",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/budgets/YOUR_BUDGET_ID",
          "host": ["{{base_url}}"],
          "path": ["budgets", "YOUR_BUDGET_ID"]
        }
      }
    },
    {
      "name": "Update Budget",
      "request": {
        "method": "PATCH",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"name\": \"Updated May Budget\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/budgets/YOUR_BUDGET_ID",
          "host": ["{{base_url}}"],
          "path": ["budgets", "YOUR_BUDGET_ID"]
        }
      }
    },
    {
      "name": "Delete Budget",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/budgets/YOUR_BUDGET_ID",
          "host": ["{{base_url}}"],
          "path": ["budgets", "YOUR_BUDGET_ID"]
        }
      }
    },
    {
      "name": "Add Budget Item",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"name\": \"Rent\",\n    \"description\": \"Monthly apartment rent\",\n    \"type\": \"expense\",\n    \"icon\": \"home\",\n    \"color\": \"#4f46e5\",\n    \"plannedAmount\": 1200\n}"
        },
        "url": {
          "raw": "{{base_url}}/budgets/YOUR_BUDGET_ID/items",
          "host": ["{{base_url}}"],
          "path": ["budgets", "YOUR_BUDGET_ID", "items"]
        }
      }
    },
    {
      "name": "Delete Budget Item",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/budgets/YOUR_BUDGET_ID/items/YOUR_ITEM_ID",
          "host": ["{{base_url}}"],
          "path": ["budgets", "YOUR_BUDGET_ID", "items", "YOUR_ITEM_ID"]
        }
      }
    },
    {
      "name": "Update Budget Item",
      "request": {
        "method": "PATCH",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"plannedAmount\": 250,\n    \"alertEnabled\": true\n}"
        },
        "url": {
          "raw": "{{base_url}}/budgets/YOUR_BUDGET_ID/items/YOUR_ITEM_ID",
          "host": ["{{base_url}}"],
          "path": ["budgets", "YOUR_BUDGET_ID", "items", "YOUR_ITEM_ID"]
        }
      }
    }

  ]
};

const categoriesIndex = collection.item.findIndex(i => i.name === 'Categories');
if (categoriesIndex !== -1) {
  collection.item[categoriesIndex] = categoriesFolder;
} else {
  collection.item.push(categoriesFolder);
}

const budgetsIndex = collection.item.findIndex(i => i.name === 'Budgets');
if (budgetsIndex !== -1) {
  collection.item[budgetsIndex] = budgetsFolder;
} else {
  collection.item.push(budgetsFolder);
}

const transactionsFolder = {
  "name": "Transactions",
  "item": [
    {
      "name": "Create Transaction",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"accountId\": \"YOUR_ACCOUNT_ID\",\n    \"budgetItemId\": \"YOUR_BUDGET_ITEM_ID\",\n    \"name\": \"Grocery Shopping\",\n    \"amount\": 150.50,\n    \"type\": \"expense\",\n    \"date\": \"2026-05-17T10:00:00Z\",\n    \"notes\": \"Bought groceries at the local supermarket\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/transactions",
          "host": ["{{base_url}}"],
          "path": ["transactions"]
        }
      }
    },
    {
      "name": "Get Transactions",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/transactions?page=1&limit=10",
          "host": ["{{base_url}}"],
          "path": ["transactions"],
          "query": [
            { "key": "page", "value": "1" },
            { "key": "limit", "value": "10" }
          ]
        }
      }
    },
    {
      "name": "Get Transaction by ID",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/transactions/YOUR_TRANSACTION_ID",
          "host": ["{{base_url}}"],
          "path": ["transactions", "YOUR_TRANSACTION_ID"]
        }
      }
    },
    {
      "name": "Update Transaction",
      "request": {
        "method": "PATCH",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"amount\": 160.00,\n    \"notes\": \"Updated price\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/transactions/YOUR_TRANSACTION_ID",
          "host": ["{{base_url}}"],
          "path": ["transactions", "YOUR_TRANSACTION_ID"]
        }
      }
    },
    {
      "name": "Delete Transaction",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/transactions/YOUR_TRANSACTION_ID",
          "host": ["{{base_url}}"],
          "path": ["transactions", "YOUR_TRANSACTION_ID"]
        }
      }
    }
  ]
};

const transactionsIndex = collection.item.findIndex(i => i.name === 'Transactions');
if (transactionsIndex !== -1) {
  collection.item[transactionsIndex] = transactionsFolder;
} else {
  collection.item.push(transactionsFolder);
}


fs.writeFileSync('BrainBudget.postman_collection.json', JSON.stringify(collection, null, 2));
console.log('Postman collection updated!');
