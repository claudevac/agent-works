from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

load_dotenv()


def create_chatbot():
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

    store = {}

    def get_session_history(session_id: str) -> InMemoryChatMessageHistory:
        if session_id not in store:
            store[session_id] = InMemoryChatMessageHistory()
        return store[session_id]

    chain = llm
    chatbot = RunnableWithMessageHistory(chain, get_session_history)

    return chatbot


def main():
    chatbot = create_chatbot()
    session_id = "default"
    config = {"configurable": {"session_id": session_id}}

    system_msg = SystemMessage(content="You are a helpful assistant.")

    print("Chatbot ready! Type 'quit' to exit.\n")

    first_turn = True
    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit"):
            print("Goodbye!")
            break

        messages = [HumanMessage(content=user_input)]
        if first_turn:
            messages.insert(0, system_msg)
            first_turn = False

        print("Bot: ", end="", flush=True)
        for chunk in chatbot.stream(messages, config=config):
            print(chunk.content, end="", flush=True)
        print("\n")


if __name__ == "__main__":
    main()
