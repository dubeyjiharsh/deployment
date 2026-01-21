import time
import logging
from typing import Tuple, Dict, Any
from openai import OpenAI
from config import settings
from utils.prompts import get_system_prompt, get_initial_canvas_prompt, get_refinement_prompt
from utils.json_parser import parse_dual_response

class ResponsesService:
    """Service for managing Azure OpenAI Responses"""

    _client = None
    _last_config = None

    @classmethod
    def reload_client(cls):
        azure_config = settings.get_azure_openai_config()
        cls._client = OpenAI(
            base_url=azure_config.get("azure_openai_endpoint", "")+"openai/v1/",
            api_key=azure_config.get("azure_openai_api_key", ""),
        )
        cls._last_config = azure_config

    def __init__(self):
        if not self.__class__._client:
            self.__class__.reload_client()
        self.azure_config = self.__class__._last_config

    @property
    def client(self):
        if not self.__class__._client:
            self.__class__.reload_client()
        return self.__class__._client

    def send_message(
        self,
        message: str,
        previous_response_id: str = None,
        file_ids: list = None,
        is_first_message: bool = False,
        current_canvas_json: dict = None
    ) -> Tuple[str, str, Dict[str, Any]]:
        """
        Send a message to the assistant and get both chat response and canvas JSON
        Args:
            response_id: The response ID
            previous_response_id: The previous response ID
            message: User's message
            file_ids: List of file IDs to attach
            is_first_message: Whether this is the first message (initial canvas generation)
            current_canvas_json: Current canvas JSON for context if manual_update is True
        Returns:
            Tuple[str, Dict]: (chat_response, canvas_json)
        """
        # Prepare input data structure
        input_data = [
            {
                "role": "user",
                "content": [],
            }
        ]

        # Prepare file attachments if any
        if file_ids:
            for fid in file_ids:
                input_data[0]['content'].append({"type": "input_file", "file_id": fid})

        # Prepare the prompt based on message type
        if is_first_message:
            prompt = get_initial_canvas_prompt(message)
            input_data[0]['content'].append({"type": "input_text", "text": prompt})
            # Send message to thread
            response = self.client.responses.create(
                model=self.azure_config.get("azure_openai_deployment_name", ""),
                instructions=get_system_prompt(),
                input = input_data,
            )

        else:
            # If manual_update is True, pass current_canvas_json as context
            prompt = get_refinement_prompt(message, current_canvas_json)
            input_data[0]['content'].append({"type": "input_text", "text": prompt})
            # Send message to thread
            response = self.client.responses.create(
                previous_response_id=previous_response_id,
                model=self.azure_config.get("azure_openai_deployment_name", ""),
                input = input_data,
            )

        response_text = response.output_text
        
        # Parse the dual response format
        chat_response, canvas_json = parse_dual_response(response_text)
        
        return response.id, chat_response, canvas_json

    def get_conversation_history(self, previous_response_id: str) -> list:
        """
        Get the full conversation history for a thread
        
        Args:
            previous_response_id: The previous response ID
        
        Returns:
            List of messages with role and parsed content
            For user messages: returns the original user message (without prompt wrappers)
            For assistant messages: returns only the chat response (without canvas JSON)
        """
        history = []
        while previous_response_id is not None:
            # Retrieve message in the thread
            response = self.client.responses.retrieve(response_id=previous_response_id)
            try:
                chat_response, _ = parse_dual_response(response.output_text)
                history.append({
                    "role": "assistant",
                    "content": chat_response
                })
            except Exception:
                # Fallback if parsing fails
                history.append({
                    "role": "assistant",
                    "content": response.output_text
                })

            # Get user message for the current response
            input_items = self.client.responses.input_items.list(previous_response_id).data[0].content
            for item in input_items:
                if getattr(item, "type", None) == "input_text" and hasattr(item, "text"):
                    parsed_content = self._extract_user_message(item.text)

            history.append({
                "role": "user",
                "content": parsed_content
            })
            # Move to previous response
            previous_response_id = response.previous_response_id

        return history[::-1]
    
    def _extract_user_message(self, prompt_content: str) -> str:
        """
        Extract the original user message from the prompt wrapper
        
        Args:
            prompt_content: The full prompt sent to the assistant
        
        Returns:
            The original user message
        """
        # Remove initial canvas generation prompt
        if "USER PROBLEM STATEMENT:" in prompt_content:
            parts = prompt_content.split("USER PROBLEM STATEMENT:")
            if len(parts) > 1:
                message_part = parts[1].split("\n\nPlease generate")[0]
                return message_part.strip()
        
        # Remove refinement prompt
        if "USER MESSAGE:" in prompt_content:
            parts = prompt_content.split("USER MESSAGE:")
            if len(parts) > 1:
                message_part = parts[1].split("\n\nREFINEMENT INSTRUCTIONS:")[0]
                return message_part.strip()
        
        # Fallback: return original content
        return prompt_content
    
    def delete_response(self, response_id: str):
        """Delete a response"""
        try:
            self.client.responses.delete(response_id)
        except Exception as e:
            logging.error(f"Error deleting response {response_id}: {e}")