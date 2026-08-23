import streamlit as st
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain.chat_models import init_chat_model

load_dotenv()

st.set_page_config(page_title="Funny AI Chatbot", page_icon="🤖")
st.title("🤖 Funny AI Chatbot")
st.caption("Powered by GPT-OSS-120B on Groq via LangChain")


@st.cache_resource
def get_model():
    return init_chat_model(
        "openai/gpt-oss-120b",
        model_provider="groq"
    )


model = get_model()

# Initialize chat history in session state
if "conversation" not in st.session_state:
    st.session_state.conversation = [
        SystemMessage(content="you are the funny AI agent")
    ]

# Sidebar controls
with st.sidebar:
    st.header("Settings")
    if st.button("🗑️ Clear conversation"):
        st.session_state.conversation = [
            SystemMessage(content="you are the funny AI agent")
        ]
        st.rerun()

# Render existing chat history (skip the SystemMessage)
for msg in st.session_state.conversation:
    if isinstance(msg, HumanMessage):
        with st.chat_message("user"):
            st.markdown(msg.content)
    elif isinstance(msg, AIMessage):
        with st.chat_message("assistant"):
            st.markdown(msg.content)

# Chat input
prompt = st.chat_input("Say something...")

if prompt:
    # Show user message immediately
    with st.chat_message("user"):
        st.markdown(prompt)

    st.session_state.conversation.append(HumanMessage(content=prompt))

    # Get and show AI response
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = model.invoke(st.session_state.conversation)
            st.markdown(response.content)

    st.session_state.conversation.append(AIMessage(content=response.content))