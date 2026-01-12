import time
import logging
from typing import Tuple, Dict, Any
from openai import AzureOpenAI
from config import settings
from utils.prompts import get_system_prompt, get_initial_canvas_prompt, get_refinement_prompt
from utils.json_parser import parse_dual_response

class AssistantService:
    """Service for managing Azure OpenAI Assistants"""
    
    def __init__(self):
        self.client = AzureOpenAI(
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY
        )
    
    def create_assistant(self) -> str:
        """Create a new assistant with the system prompt"""
        assistant = self.client.beta.assistants.create(
            name="Business Canvas Assistant",
            model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            instructions=get_system_prompt(),
            tools=[{"type": "file_search"}],
        )
        return assistant.id
    
    def create_thread(self) -> str:
        """Create a new conversation thread"""
        thread = self.client.beta.threads.create()
        return thread.id
    
    def send_message(
        self,
        thread_id: str,
        assistant_id: str,
        message: str,
        file_ids: list = None,
        is_first_message: bool = False
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Send a message to the assistant and get both chat response and canvas JSON
        
        Args:
            thread_id: The thread ID
            assistant_id: The assistant ID
            message: User's message
            file_ids: List of file IDs to attach
            is_first_message: Whether this is the first message (initial canvas generation)
        
        Returns:
            Tuple[str, Dict]: (chat_response, canvas_json)
        """
        # Prepare the prompt based on message type
        if is_first_message:
            prompt = get_initial_canvas_prompt(message)
        else:
            prompt = get_refinement_prompt(message)
        
        # Prepare file attachments if any
        attachments = []
        if file_ids:
            attachments = [
                {"file_id": fid, "tools": [{"type": "file_search"}]} 
                for fid in file_ids
            ]
        
        # Send message to thread
        self.client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=prompt,
            attachments=attachments if attachments else None
        )
        
        # Create and wait for run to complete
        run = self.client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )
        
        completed_run = self._wait_for_run_completion(thread_id, run.id)
        
        # Get the assistant's response
        messages = self.client.beta.threads.messages.list(thread_id=thread_id)
        latest_message = messages.data[0]
        
        if latest_message.role != "assistant":
            raise ValueError("Expected assistant response but got user message")
        
        response_text = latest_message.content[0].text.value
        
        # Parse the dual response format
        chat_response, canvas_json = parse_dual_response(response_text)
        
        return chat_response, canvas_json
    
    def _wait_for_run_completion(self, thread_id: str, run_id: str, timeout: int = 300):
        """
        Wait for a run to complete
        
        Args:
            thread_id: The thread ID
            run_id: The run ID
            timeout: Maximum time to wait in seconds
        
        Returns:
            The completed run object
        
        Raises:
            TimeoutError: If run doesn't complete within timeout
            RuntimeError: If run fails, is cancelled, or expires
        """
        start_time = time.time()
        
        while True:
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Run {run_id} did not complete within {timeout} seconds")
            
            run = self.client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run_id
            )
            
            if run.status == "completed":
                return run
            
            if run.status in ["failed", "cancelled", "expired"]:
                error_msg = f"Run {run_id} ended with status: {run.status}"
                if run.last_error:
                    error_msg += f" - {run.last_error.message}"
                raise RuntimeError(error_msg)
            
            # Wait before checking again
            time.sleep(1)
    
    def get_conversation_history(self, thread_id: str) -> list:
        """
        Get the full conversation history for a thread
        
        Args:
            thread_id: The thread ID
        
        Returns:
            List of messages with role and parsed content
            For user messages: returns the original user message (without prompt wrappers)
            For assistant messages: returns only the chat response (without canvas JSON)
        """
        messages = self.client.beta.threads.messages.list(thread_id=thread_id)
        
        history = []
        for msg in reversed(messages.data):
            content = msg.content[0].text.value if msg.content else ""
            
            if msg.role == "user":
                # Extract original user message from the prompt wrapper
                parsed_content = self._extract_user_message(content)
                history.append({
                    "role": "user",
                    "content": parsed_content
                })
            elif msg.role == "assistant":
                # Extract only the chat response, exclude canvas JSON
                try:
                    chat_response, _ = parse_dual_response(content)
                    history.append({
                        "role": "assistant",
                        "content": chat_response
                    })
                except Exception:
                    # Fallback if parsing fails
                    history.append({
                        "role": "assistant",
                        "content": content
                    })
        
        return history
    
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
                message_part = parts[1].split("\n\nPlease refine")[0]
                return message_part.strip()
        
        # Fallback: return original content
        return prompt_content
    
    def delete_assistant(self, assistant_id: str):
        """Delete an assistant"""
        try:
            self.client.beta.assistants.delete(assistant_id)
        except Exception as e:
            logging.error(f"Error deleting assistant {assistant_id}: {e}")

    def delete_thread(self, thread_id: str):
        """Delete a conversation thread"""
        try:
            self.client.beta.threads.delete(thread_id)
        except Exception as e:
            logging.error(f"Error deleting thread {thread_id}: {e}")