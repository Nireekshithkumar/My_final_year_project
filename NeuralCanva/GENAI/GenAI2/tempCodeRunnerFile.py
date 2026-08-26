from langchain_community.document_loaders.web_base import WebBaseLoader
data=WebBaseLoader('https://neuralcanvasteam.vercel.app/')
docs=data.load()
print(docs[0].page_content)