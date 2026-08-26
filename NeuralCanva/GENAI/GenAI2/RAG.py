from dotenv import load_dotenv
from langchain_mistralai import ChatMistralAI
from langchain_community.document_loaders import TextLoader
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()  # .env must contain MISTRAL_API_KEY=your_key

loader = TextLoader("recovery-codes.txt", encoding="utf-8")
docs = loader.load()

template = ChatPromptTemplate.from_messages([
    ("system", "You are an AI assistant that summarizes the provided text clearly and concisely."),
    ("human", "Summarize this text:\n\n{data}")
])

model = ChatMistralAI(model="mistral-small-2506")

prompt = template.format_messages(data=docs[0].page_content)
result = model.invoke(prompt)

print(result.content)