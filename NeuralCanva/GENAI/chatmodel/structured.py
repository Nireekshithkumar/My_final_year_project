from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model
from pydantic import BaseModel
from typing import List 
from langchain_core.output_parsers import PydanticOutputParser
from dotenv import load_dotenv
load_dotenv()

class Movie(BaseModel):
    title:str
    genre:List[str]
    cast:List[str]
   
    

paser=PydanticOutputParser(pydantic_object=Movie)
 
model = init_chat_model(
    "openai/gpt-oss-120b",
    model_provider="groq"
)
while True:
    user=input("USER:-")
    
    prompt = ChatPromptTemplate.from_messages([
    ("system", "{system_temp}"),
    ("human", "{human_temp}")
])

    final_prompt=prompt.invoke({
        'system_temp':paser,
        'human_temp':user
                         })
    ouput=model.invoke(final_prompt)
    print(f'AI:- {ouput.content}')
    
