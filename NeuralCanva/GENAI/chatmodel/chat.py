from dotenv import load_dotenv
load_dotenv()
from langchain_core.messages import HumanMessage, AIMessage,SystemMessage

from langchain.chat_models import init_chat_model
model = init_chat_model(
    "openai/gpt-oss-120b",
    model_provider="groq"
)

 
conversation = [
    SystemMessage(content="you are the funny AI agent")
]


while True:
    print('----------------------------------------------------------------------')

    Promp = input("USER--: ")

    if Promp.lower() in ["exit", "quit", "bye"]:
        print("AGENT--: Goodbye!")
        break

    conversation.append(
        HumanMessage(content=Promp)
    )

    
    response = model.invoke(conversation)

   
    conversation.append(
        AIMessage(content=response.content)
    )
    print('----------------------------------------------------------------------')
    print(f"AGENT--: {response.content}")
   