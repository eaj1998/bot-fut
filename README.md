# Faz o Simples (Sports Management API & Bot)

A robust Node.js/TypeScript application acting as both a REST API and a WhatsApp Chatbot to streamline amateur soccer group management, including roster automation, financial ledgers, and attendance tracking.

![Node.js](https://img.shields.io/badge/Node.js-18.x-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![Docker](https://img.shields.io/badge/Docker-Enabled-blue) ![License](https://img.shields.io/badge/License-ISC-grey)

## Key Features

-   **Automated Roster Management:** Manages weekly game lineups, waitlists, and guest additions via WhatsApp commands (e.g., `/bora`, `/opt-out`).
-   **Financial Ledger:** Tracks payments, debts, and credits per player and workspace.
-   **Automated Billing:** Node-Cron jobs for scheduled billing and invoice generation.
-   **WhatsApp Automation:** Built on `whatsapp-web.js` for seamless group interaction and notifications.
-   **Concurrency Control:** Handles simultaneous signup requests to prevent roster inconsistencies using MongoDB transactions.
-   **Multi-Tenancy:** Supports multiple "workspaces" (soccer groups) with isolated data and configurations.

## Architecture

The project follows **Clean Architecture** principles to separate concerns and ensure maintainability:

-   **Dependency Injection:** Uses `tsyringe` for IoC, decoupling services, controllers, and repositories.
-   **Service Layer:** Business logic is encapsulated in services (`GameService`, `FinancialService`, `WhatsAppService`), keeping controllers thin.
-   **Repository Pattern:** Data access logic is abstracted via repositories (`GameRepository`, `UserRepository`), enabling easier testing and database switching if needed.
-   **Strict Typing:** Developed in strict-mode TypeScript for reliability and developer experience.

## Prerequisites

-   **Node.js**: v18+
-   **MongoDB**: v5.0+ (Replica Set required for Transactions)
-   **Docker** (Optional, for containerized deployment)

## Installation & Run

### Local Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Environment:**
    Copy `.env.example` to `.env` and populate variables (see below).

3.  **Run in Development Mode:**
    ```bash
    npm run debug
    ```

### Docker Deployment

1.  **Build and Run:**
    ```bash
    docker-compose up -d --build
    ```

## Environment Variables

Ensure these variables are set in your `.env` file:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | API Port | `3000` |
| `MONGO_URI` | MongoDB Connection String | `mongodb://localhost:27017` |
| `MONGO_DB` | Database Name | `bot-futebol` |
| `JWT_SECRET` | Secret for API Authentication | `supersecretkey` |
| `ADMIN_PHONE` | Admin WhatsApp (E.164) | `+5511999999999` |
| `ORGANIZZE_API_KEY` | Optional integration | `your_api_key` |

## License

This project is licensed under the ISC License.