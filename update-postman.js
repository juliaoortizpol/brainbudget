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
          "raw": "{\n    \"name\": \"May 2026 Budget\",\n    \"periodType\": \"monthly\",\n    \"startDate\": \"2026-05-01T00:00:00Z\",\n    \"endDate\": \"2026-05-31T23:59:59Z\",\n    \"status\": \"active\",\n    \"items\": [\n        {\n            \"expenseCategoryId\": \"YOUR_CATEGORY_ID\",\n            \"plannedAmount\": 500\n        }\n    ]\n}"
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

const hasCategories = collection.item.some(i => i.name === 'Categories');
const hasBudgets = collection.item.some(i => i.name === 'Budgets');

if (!hasCategories) collection.item.push(categoriesFolder);
if (!hasBudgets) collection.item.push(budgetsFolder);

fs.writeFileSync('BrainBudget.postman_collection.json', JSON.stringify(collection, null, 2));
console.log('Postman collection updated!');
