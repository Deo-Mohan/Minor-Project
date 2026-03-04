# Minor-Project

MediBot AI is a professional-grade healthcare ecosystem designed to bridge the gap between complex medical data and everyday users. By leveraging Google Gemini AI and the OpenFDA database, it provides a unified platform for medication safety, pill identification, and symptom triage.

## Project Structure

```
├── drug-info-web/     # Web application
│   ├── database.js
│   ├── package.json
│   ├── server.js
│   └── public/
│       ├── index.html
│       ├── features.html
│       └── script.js
└── telegram-bot/      # Telegram bot
    ├── bot.js
    ├── check_models.js
    ├── database.js
    └── package.json
```

## Setup

1. Install dependencies for each module:
   ```
   cd drug-info-web && npm install
   cd ../telegram-bot && npm install
   ```

2. Configure environment variables if needed (.env files)

3. Run the applications:
   - Drug Info Web: `cd drug-info-web && npm start`
   - Telegram Bot: `cd telegram-bot && npm start`

## Requirements

- Node.js (v14 or higher)
- npm or yarn

## License

This project is licensed under the MIT License.
>>>>>>> 78fad643239467aae5c15473b8edaba989f72196
