# agent-works

Experimenting with LangChain agents and chatbots.

## Chatbot (LangChain + Gemini)

A simple conversational chatbot using LangChain with Google Gemini and in-memory chat history.

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Configure

1. Get a Google API key from https://aistudio.google.com/apikey
2. Copy the example env file and add your key:

```bash
cp .env.example .env
# edit .env and paste your GOOGLE_API_KEY
```

### Run

```bash
python chatbot.py
```

Type messages to chat. Type `quit` to exit.
