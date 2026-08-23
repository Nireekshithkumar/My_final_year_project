"""
NeuralCanva AI Provider Abstraction
Handles multi-provider initialization and automatic fallback.
Priority:
  1. Groq (llama-3.3-70b-versatile / mixtral-8x7b-32768)
  2. Google Gemini (gemini-2.5-flash / gemini-1.5-flash)
  3. Mistral (mistral-large-latest / mistral-small-latest)
  4. OpenAI (gpt-4o-mini / gpt-3.5-turbo)
  5. Deterministic Offline Heuristic Engine (if no keys or all providers exhausted)
"""

import os
import logging
from typing import Optional, Tuple, Any

logger = logging.getLogger(__name__)


class ProviderManager:
    """
    Manages LLM providers with automatic fallback on rate-limits, quota exceeded, or errors.
    Never exposes API keys to client code.
    """

    @classmethod
    def get_configured_providers(cls) -> list[dict]:
        """Returns list of configured providers and their availability."""
        providers = []
        
        # 1. Groq
        groq_key = os.environ.get("GROQ_API_KEY", "").strip()
        if groq_key:
            providers.append({"name": "Groq", "id": "groq", "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")})

        # 2. Gemini
        gemini_key = (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")).strip()
        if gemini_key:
            providers.append({"name": "Google Gemini", "id": "gemini", "model": os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")})

        # 3. Mistral
        mistral_key = os.environ.get("MISTRAL_API_KEY", "").strip()
        if mistral_key:
            providers.append({"name": "Mistral AI", "id": "mistral", "model": os.environ.get("MISTRAL_MODEL", "mistral-small-latest")})

        # 4. OpenAI
        openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if openai_key:
            providers.append({"name": "OpenAI", "id": "openai", "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini")})

        return providers

    @classmethod
    def get_active_model(cls, temperature: float = 0.2) -> Tuple[Optional[Any], str]:
        """
        Tries to instantiate the highest-priority available LLM provider.
        Returns: (langchain_chat_model, provider_name)
        """
        # Try Groq
        groq_key = os.environ.get("GROQ_API_KEY", "").strip()
        if groq_key:
            try:
                from langchain_groq import ChatGroq
                model_name = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
                chat = ChatGroq(
                    api_key=groq_key,
                    model=model_name,
                    temperature=temperature,
                    max_retries=2,
                )
                return chat, f"Groq ({model_name})"
            except Exception as e:
                logger.warning(f"Groq provider init failed: {e}. Attempting fallback...")

        # Try Google Gemini
        gemini_key = (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")).strip()
        if gemini_key:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                model_name = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
                chat = ChatGoogleGenerativeAI(
                    google_api_key=gemini_key,
                    model=model_name,
                    temperature=temperature,
                    max_retries=2,
                )
                return chat, f"Gemini ({model_name})"
            except Exception as e:
                logger.warning(f"Gemini provider init failed: {e}. Attempting fallback...")

        # Try Mistral
        mistral_key = os.environ.get("MISTRAL_API_KEY", "").strip()
        if mistral_key:
            try:
                from langchain_mistralai import ChatMistralAI
                model_name = os.environ.get("MISTRAL_MODEL", "mistral-small-latest")
                chat = ChatMistralAI(
                    api_key=mistral_key,
                    model_name=model_name,
                    temperature=temperature,
                    max_retries=2,
                )
                return chat, f"Mistral ({model_name})"
            except Exception as e:
                logger.warning(f"Mistral provider init failed: {e}. Attempting fallback...")

        # Try OpenAI
        openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if openai_key:
            try:
                from langchain_openai import ChatOpenAI
                model_name = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
                chat = ChatOpenAI(
                    api_key=openai_key,
                    model=model_name,
                    temperature=temperature,
                    max_retries=2,
                )
                return chat, f"OpenAI ({model_name})"
            except Exception as e:
                logger.warning(f"OpenAI provider init failed: {e}. Attempting fallback...")

        return None, "Offline Heuristic Engine"

    @classmethod
    def get_status(cls) -> dict:
        """Returns the health status and available providers for the UI indicator."""
        providers = cls.get_configured_providers()
        is_online = len(providers) > 0
        active_name = providers[0]["name"] if providers else "Offline Heuristic Mode"
        return {
            "online": is_online,
            "active_provider": active_name,
            "configured_providers": providers,
            "fallback_ready": True,
        }
