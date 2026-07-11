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
          "raw": "{\n    \"budgetItemId\": \"YOUR_BUDGET_ITEM_ID\",\n    \"name\": \"Grocery Shopping\",\n    \"amount\": 150.50,\n    \"type\": \"expense\",\n    \"date\": \"2026-05-17T10:00:00Z\",\n    \"notes\": \"Bought groceries at the local supermarket\"\n}"
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


const integrationsFolder = {
  "name": "Integrations",
  "item": [
    {
      "name": "Get Gmail Auth URL",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/integrations/gmail/auth",
          "host": ["{{base_url}}"],
          "path": ["integrations", "gmail", "auth"]
        }
      }
    },
    {
      "name": "Get Gmail Connection Status",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/integrations/gmail/status",
          "host": ["{{base_url}}"],
          "path": ["integrations", "gmail", "status"]
        }
      }
    },
    {
      "name": "Test Fetch Gmails",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/integrations/gmail/test-fetch?query=newer_than:5d",
          "host": ["{{base_url}}"],
          "path": ["integrations", "gmail", "test-fetch"],
          "query": [
            { "key": "query", "value": "newer_than:5d" }
          ]
        }
      }
    },
    {
      "name": "Sync Gmails (Engine)",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/integrations/gmail/sync",
          "host": ["{{base_url}}"],
          "path": ["integrations", "gmail", "sync"]
        }
      }
    },
    {
      "name": "Disconnect Gmail",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/integrations/gmail/disconnect",
          "host": ["{{base_url}}"],
          "path": ["integrations", "gmail", "disconnect"]
        }
      }
    }
  ]
};

const integrationsIndex = collection.item.findIndex(i => i.name === 'Integrations');
if (integrationsIndex !== -1) {
  collection.item[integrationsIndex] = integrationsFolder;
} else {
  collection.item.push(integrationsFolder);
}

const emailParserFolder = {
  "name": "Email Parser",
  "item": [
    {
      "name": "Seed Institution Configs",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/email-parser/seed",
          "host": ["{{base_url}}"],
          "path": ["email-parser", "seed"]
        }
      }
    },
    {
      "name": "Test Email Parse",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n    \"senderEmail\": \"alerts@chase.com\",\n    \"subject\": \"Your credit card transaction\",\n    \"emailBody\": \"A charge of $45.99 was authorized.\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/email-parser/test-parse",
          "host": ["{{base_url}}"],
          "path": ["email-parser", "test-parse"]
        }
      }
    },
    {
      "name": "Test Banreservas Parse",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwt_token}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": JSON.stringify({
            senderEmail: "JULIO5001@hotmail.com",
            subject: "RV: Notificaciones Banreservas.",
            emailBody: `<div>\n<table class=\"m_1515877806030726481container\">\n<tbody>\n<tr>\n<td>\n<table class=\"m_1515877806030726481email_content\">\n<tbody>\n<tr>\n<td><img class=\"m_1515877806030726481logo CToWUd\" src=\"https://...\" width=\"206.13px\" height=\"47.2px\" data-bit=\"iit\">\n</td>\n</tr>\n<tr>\n<td><img class=\"m_1515877806030726481success CToWUd\" src=\"https://...\" width=\"90\" height=\"64\" alt=\"Success\" data-bit=\"iit\">\n</td>\n</tr>\n<tr>\n<td></td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481message_title\">Notificación de Consumo</td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481message_body\">Su tarjeta VISA GOLD ••4134 presenta un consumo. </td>\n</tr>\n<tr>\n<td>\n<table class=\"m_1515877806030726481amount_container\">\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481amount_label\">Monto:</td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481amount_value\">DOP 173.56</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td>\n<table class=\"m_1515877806030726481details_container\">\n<tbody>\n<tr>\n<td>\n<table class=\"m_1515877806030726481details_table\">\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481details_table_icons_first\"><img src=\"...\" width=\"24px\" height=\"24px\" class=\"CToWUd\" data-bit=\"iit\">\n</td>\n<td class=\"m_1515877806030726481details_table_icons_space_first\"></td>\n<td class=\"m_1515877806030726481details_table_description_first\">\n<table>\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_label\">Estado: </td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_value\">APROBADO </td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_icons\"><img src=\"...\" width=\"18px\" height=\"22px\" class=\"CToWUd\" data-bit=\"iit\">\n</td>\n<td class=\"m_1515877806030726481details_table_icons_space\"></td>\n<td class=\"m_1515877806030726481details_table_description\">\n<table>\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_label\">Comercio: </td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_value\">HELADOS BON R DUARTE SANTO DOMINGODO </td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_icons\"><img src=\"...\" width=\"24px\" height=\"24px\" class=\"CToWUd\" data-bit=\"iit\">\n</td>\n<td class=\"m_1515877806030726481details_table_icons_space\"></td>\n<td class=\"m_1515877806030726481details_table_description\">\n<table>\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_label\">Fecha de transacción: </td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_value\">28/06/2026 03:59 PM </td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_icons_last\"><img src=\"...\" width=\"24px\" height=\"24px\" class=\"CToWUd\" data-bit=\"iit\">\n</td>\n<td class=\"m_1515877806030726481details_table_icons_space_last\"></td>\n<td class=\"m_1515877806030726481details_table_description_last\">\n<table>\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_label\">Número de aprobación: </td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_description_value\">615597 </td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td class=\"m_1515877806030726481details_table_footer\">Recibido por los valores indicados en este comprobante.\n</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td>\n<table class=\"m_1515877806030726481disclamer_container\">\n<tbody>\n<tr>\n<td class=\"m_1515877806030726481disclamer_text\">\n<p>Este correo fue enviado a <span style=\"font-weight:700\"><a href=\"mailto:JULIO5001@HOTMAIL.COM\" target=\"_blank\">JULIO5001@HOTMAIL.COM</a>.</span> <span class=\"il\"><span class=\"il\"><span class=\"il\"><span class=\"il\">Banreservas</span></span></span></span> envía este correo electrónico porque tu perfil nos indica que esta información es relevante para ti.<br>\n<br>\nNo respondas a este mensaje, has sido notificado de forma automática.<br>\n<br>\n<span style=\"font-weight:700\">De no reconocer esta transacción</span>, favor contactarnos al (809) 960-4400.\n</p>\n</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n<tr>\n<td align=\"center\">\n<table width=\"327\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n<tbody>\n<tr>\n<td align=\"center\" style=\"padding-top:14px\"><img src=\"...\" width=\"150\" height=\"20\" alt=\"Footer\" style=\"display:block;margin:0 auto\" class=\"CToWUd\" data-bit=\"iit\">\n</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n</tbody>\n</table>\n<img alt=\"\" src=\"...\" style=\"display:none;width:1px;height:1px\" class=\"CToWUd\" data-bit=\"iit\"><div class=\"yj6qo\"></div><div class=\"adL\">\n</div></div>`
          }, null, 2)
        },
        "url": {
          "raw": "{{base_url}}/email-parser/test-parse",
          "host": ["{{base_url}}"],
          "path": ["email-parser", "test-parse"]
        }
      }
    }
  ]
};

const parserIndex = collection.item.findIndex(i => i.name === 'Email Parser');
if (parserIndex !== -1) {
  collection.item[parserIndex] = emailParserFolder;
} else {
  collection.item.push(emailParserFolder);
}

fs.writeFileSync('BrainBudget.postman_collection.json', JSON.stringify(collection, null, 2));
console.log('Postman collection updated!');
