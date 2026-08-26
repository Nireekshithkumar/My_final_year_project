from langchain_community.document_loaders.web_base import WebBaseLoader
data=WebBaseLoader('https://www.apple.com/in/shop/buy-iphone')
docs=data.load()
print(docs)