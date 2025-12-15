# Standard library imports
import os
import json
from dotenv import load_dotenv
import threading
import time

# Lang Chain imports
from langchain_openai import AzureChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.callbacks import CallbackManager
from langchain_core.callbacks.base import BaseCallbackHandler

# LangChain Cache imports
from langchain_community.cache import SQLiteCache
from langchain_core.globals import set_llm_cache
import hashlib

# Logger import
from utils.logutils import get_logger, log_context

# Initialize logger
logger = get_logger()

# Load Azure OpenAI environment variables
load_dotenv()

# Proxy Configurations (Optional / Set here if required)
# os.environ["HTTP_PROXY"] = os.getenv("HTTP_PROXY")
# os.environ["HTTPS_PROXY"] = os.getenv("HTTPS_PROXY")
# os.environ["SSL_CERT_FILE"] = os.getenv("SSL_CERT_FILE")
os.environ["NO_PROXY"] = os.getenv("NO_PROXY")

# Load Azure Configuration variables
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
AZURE_OPENAI_TEMPERATURE = float(os.getenv("AZURE_OPENAI_TEMPERATURE"))

# System & Field Prompts Configurations
SYSTEM_PROMPT=os.getenv("SYSTEM_PROMPT")
EDIT_PROMPT=os.getenv("EDIT_PROMPT")

# Cache Configuration - Set this in your .env file
SQLITE_CACHE_PATH = os.getenv("SQLITE_CACHE_PATH")
CACHE_TTL = int(os.getenv("CACHE_TTL"))  # Time-to-live in seconds (default 1 hour)
CACHE_ENABLED = os.getenv("CACHE_ENABLED").lower() == "true"

# Configure the SQLite cache with Automatic Cache Clearing Schedule
def setup_cache(user_name="system", session_id="default"):
    """Sets up the LLM SQLite cache with periodic complete clearing"""
    if CACHE_ENABLED:
        log_context('info', user_name, session_id, f"Setting up SQLiteCache at {SQLITE_CACHE_PATH} with auto-clearing every {CACHE_TTL} seconds")
        cache = SQLiteCache(database_path=SQLITE_CACHE_PATH)
        set_llm_cache(cache)
        
        def clear_cache_periodically():
            while True:
                time.sleep(CACHE_TTL)
                log_context('info', user_name, session_id, "Clearing cache due to TTL expiration")
                cache.clear()
                
        # Start background thread to clear cache
        clear_thread = threading.Thread(target=clear_cache_periodically, daemon=True)
        clear_thread.start()
    else:
        log_context('info', user_name, session_id, "LLM caching disabled")

# Initialize cache at startup
setup_cache()

# Cache diagnostics for monitoring
cache_hits = 0
cache_misses = 0

class CacheMonitorCallbackHandler(BaseCallbackHandler):
    """Callback handler to monitor cache hits and misses"""
    
    def __init__(self, user_name="system", session_id="default"):
        self.user_name = user_name
        self.session_id = session_id
    
    def on_llm_start(self, serialized, prompts, **kwargs):
        global cache_misses
        cache_misses += 1
        log_context('info', self.user_name, self.session_id, f"Cache miss - Making API call (Total misses: {cache_misses})")
    
    def on_llm_end(self, response, **kwargs):
        pass
        
    def on_retriever_end(self, **kwargs):
        global cache_hits
        # This is a workaround since direct cache hit callbacks might not be available
        # in newer LangChain versions
        cache_hits += 1
        log_context('info', self.user_name, self.session_id, f"Cache hit! (Total hits: {cache_hits})")

# Creating callback manager with cache monitoring
callback_handler = CacheMonitorCallbackHandler()
callback_manager = CallbackManager(handlers=[callback_handler])

# Initializing AzureChatOpenAI LLM with caching enabled
llm = AzureChatOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    azure_deployment=AZURE_OPENAI_DEPLOYMENT_NAME,
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    temperature=AZURE_OPENAI_TEMPERATURE,
    # cache=CACHE_ENABLED,  # Use the CACHE_ENABLED setting
    # callbacks=[callback_handler]
)
# Function that can be used to track cache activity by comparing the previous number of misses with the current number.
def track_cache_activity():
    """
    Returns a function that can be used to track cache activity by comparing
    the previous number of misses with the current number.
    
    Returns:
        function: A function that can be called to check if a cache hit occurred
    """
    prior_misses = cache_misses
    
    def check_if_hit():
        return prior_misses == cache_misses
    
    return check_if_hit

# Cache stats function
def get_cache_stats(user_name="system", session_id="default"):
    """
    Returns current cache statistics.
    
    Returns:
        dict: A dictionary containing cache hits and misses.
    """
    stats = {
        "hits": cache_hits,
        "misses": cache_misses,
        "hit_ratio": cache_hits / (cache_hits + cache_misses) if (cache_hits + cache_misses) > 0 else 0,
        "total_requests": cache_hits + cache_misses
    }
    log_context('debug', user_name, session_id, f"Cache stats: {stats}")
    return stats

# Reads a JSON file from the given path
def read_json(path: str, user_name="system", session_id="default"):
    """
    Reads a JSON file from the given path.
    
    Args:
        path (str): The path to the JSON file to read.
        
    Returns:
        dict: The parsed JSON content from the file.
        
    Exceptions:
        Exception: If the file cannot be opened or the content is not valid JSON.
    """
    try:
        with open(path, "r") as f:
            json_output = json.load(f)
        log_context('debug', user_name, session_id, f"Successfully loaded JSON from {path}")
        return json_output
    except Exception as e:
        log_context('error', user_name, session_id, f"Error in loading JSON from {path}: {e}")
        raise json.JSONDecodeError("No JSON content found in response")
    
# Extracts the JSON content from the LLM (Language Model) response text   
def parse_llm_response(response_text, user_name="system", session_id="default"):
    """
    Extracts the JSON content from the LLM (Language Model) response text.
    
    Args:
        response_text (str): The raw response text from the LLM.
        
    Returns:
        dict: The parsed canvas data from the response.
        
    Exceptions:
        ValueError: If no JSON content is found in the response.
        Exception: If an error occurs during the parsing process.
    """
    try:
        # Find the JSON content within the response
        # log_context('debug', user_name, session_id, f"RESPONSE TEXT: \n{response_text}")
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        if start_idx == -1 or end_idx == 0:
            log_context('error', user_name, session_id, "No JSON content found in LLM response")
            raise ValueError("No JSON content found in response")
        json_content = response_text[start_idx:end_idx]
        canvas_data = json.loads(json_content)
        for k, v in canvas_data.items():
            if isinstance(v, list):
                canvas_data[k] = " ".join(v)
        log_context('info', user_name, session_id, "Successfully parsed JSON from LLM response")
        return canvas_data
    except Exception as e:
        log_context('error', user_name, session_id, f"Error parsing LLM response: {e}")
        return None

# Saves the business canvas data to a JSON file
def save_to_json(data, filename="business_canvas.json", user_name="system", session_id="default"):
    """
    Saves the business canvas data to a JSON file.
    
    Args:
        data (dict): The business canvas data to save.
        filename (str, optional): The name of the file to save the data to (default is 'business_canvas.json').
        
    Returns:
        None
        
    Exceptions:
        Exception: If an error occurs while saving the data to the file.
    """
    try:
        with open(filename, 'w') as f:
            json.dump(data, f, indent=4)
        log_context('info', user_name, session_id, f"Business canvas saved to {filename}")
    except Exception as e:
        log_context('error', user_name, session_id, f"Error saving to JSON file {filename}: {e}")

# Displays the business canvas in a formatted way
def display_business_canvas(canvas_data, user_name="system", session_id="default"):
    """
    Displays the business canvas in a formatted way.
    
    Args:
        canvas_data (dict): The business canvas data to display.
        
    Returns:
        None
        
    Exceptions:
        None
    """
    log_context('info', user_name, session_id, "Displaying current Business Canvas")
    for i, (field, value) in enumerate(canvas_data.items(), 1):
        log_context('debug', user_name, session_id, f"Canvas field {i}. {field}: {value}")

# Identifies fields with placeholder values that need user input        
def identify_missing_fields(canvas_data, user_name="system", session_id="default"):
    """
    Identifies fields with placeholder values that need user input.
    
    Args:
        canvas_data (dict): The business canvas data to check.
        
    Returns:
        tuple: Four lists of field names (mandatory fields, additional fields 1, 2, 3).
        
    Exceptions:
        None
    """
    placeholder_values = ("NO INFORMATION PROVIDED", "None", "X", "Y", "Z", "DEPENDENCIES NOT SATISFIED")
    remaining_fields = []
    for i, (field, value) in enumerate(canvas_data.items()):
        if str(value) in placeholder_values:
            remaining_fields.append(field)
    
    log_context('info', user_name, session_id, f"Missing fields: {remaining_fields}")
    return remaining_fields

# Cache key generator for more efficient caching
def generate_cache_key(prompt, field_list=None, user_input=None, current_canvas=None, user_name="system", session_id="default"):
    """
    Generates a consistent cache key for LLM requests.
    
    Args:
        prompt (str): The base prompt.
        field_list (list, optional): List of fields to include in key.
        user_input (str, optional): User input to include in key.
        current_canvas (dict, optional): Canvas state to include in key.
        
    Returns:
        str: A hash that can be used as a cache key.
    """
    key_components = [prompt]
    
    if field_list:
        key_components.append(str(field_list))
    
    if user_input:
        key_components.append(user_input)
    
    if current_canvas:
        # Only include relevant fields to avoid unnecessary cache misses
        relevant_canvas = {k: v for k, v in current_canvas.items() if k in field_list} if field_list else current_canvas
        key_components.append(json.dumps(relevant_canvas, sort_keys=True))
    
    # Create a deterministic hash of all components
    key_string = "||".join(key_components)
    hash_key = hashlib.md5(key_string.encode()).hexdigest()
    log_context('debug', user_name, session_id, f"Generated cache key: {hash_key}")
    return hash_key

# Generates a new prompt for updating the business canvas with the provided user input
def new_prompt(description, field_list, user_input, current_canvas, user_name="system", session_id="default"):
    """
    Generates a new prompt for updating the business canvas with the provided user input.
    
    Args:
        field_list (list): A list of the fields to update.
        user_input (str): The user input to extract meaningful information from.
        current_canvas (dict): The current business canvas to base updates on.
        
    Returns:
        dict: The updated business canvas after the new prompt is processed.
        
    Exceptions:
        Exception: If an error occurs during the prompt generation or response parsing.
    """
    try:
        log_context('info', user_name, session_id, f"Generating new prompt for fields: {field_list}")
        edit_prompt=read_json(EDIT_PROMPT, user_name, session_id)
        prompt = edit_prompt["system_prompt"].format(
            field_list=field_list,
            current_canvas=current_canvas,
            user_input=user_input,
            description=description
        )
        print(current_canvas)
        # Make LLM call with caching enabled
        log_context('info', user_name, session_id, "Calling LLM to generate updated canvas values")
        response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content="Generate values that satisfies all the guidelines, dependencies and guardrails for all the fields and update the existing canvas. Only generate values by meaningful information present in user input. If user input is not meaningful then use values from current canvas and let user know that user input is not meaningful")])
        response_json = parse_llm_response(response.content, user_name, session_id)
        copy_canvas = current_canvas.copy()
        for key in response_json.keys():
            copy_canvas[key] = response_json[key]

        log_context('info', user_name, session_id, "Successfully updated canvas with new values")
        return copy_canvas
    except Exception as e:
        log_context('error', user_name, session_id, f"Error generating BIC: {e}")
        raise e

# Generates a business canvas based on the user input using an LLM model   
def generate_business_canvas(user_input, field_list, description, user_name="system", session_id="default"):
    """
    Generates a business canvas based on the user input using an LLM model.
    
    Args:
        user_input (str): The user input to generate the business canvas from.
        field_list (list): A list of fields to include in the canvas.
        
    Returns:
        dict: The generated business canvas.
        
    Exceptions:
        Exception: If there is an error in generating or parsing the response.
    """
    log_context('info', user_name, session_id, "Generating initial business canvas")
    prompt_template=read_json(SYSTEM_PROMPT, user_name, session_id)
    full_prompt = prompt_template["system_prompt"].format(user_input=user_input, field_list=field_list,description=description)
    log_context('info', user_name, session_id, "Calling LLM to generate business canvas")
    response = llm.invoke([SystemMessage(content=full_prompt)])
    return parse_llm_response(response.content, user_name, session_id)

# Creates a prompt to update a single field in the business canvas based on user input
def single_field_update(user_input:str, field_name:str, user_name="system", session_id="default"):
    """
    Creates a prompt to update a single field in the business canvas based on user input.
    
    Args:
        user_input (str): The user input to extract meaningful information from.
        field_name (str): The name of the field to update.
        
    Returns:
        str: A prompt for updating the field.
        
    Exceptions:
        None
    """
    log_context('info', user_name, session_id, f"Creating prompt to update field: {field_name}")
    return f"Update {field_name} by extracting meaningful information from this user input: {user_input}. If you are unable to extract meaninful information from user input then inform user you were not able to understand the message and ask user to provide a more clearer input."

# Checks the user input for a "yes" or "no" response and prompts accordingly
def yes_no_check(user_input: str, user_name="system", session_id="default"):
    """
    Checks the user input for a "yes" or "no" response and prompts accordingly.
    
    Args:
        user_input (str): The user input to evaluate.
        
    Returns:
        str: The LLM's response content based on the user's input.
        
    Exceptions:
        None
    """
    log_context('info', user_name, session_id, f"Checking yes/no response: {user_input}")

    # if user_input == "I will complete them later":
    #     prompt = """You are a helpful assistant that check the user input. If user input is 'I will complete them later' then return a text message asking the user to provide further context to generate or repopulate the Business Idea Canvas."""
    #     response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=f"This is the user message: {user_input}")])
    #     log_context('info', user_name, session_id, f"User indicated 'I'll complete them later' response, providing edit instructions")
    
    if user_input == "No, I'd like to review and make edits":
        prompt = """You are a helpful assistant that check the user input. If user input is 'NOT SATISFIED' or 'NO' or 'I AM NOT SATISFIED' or 'No, I'd like to review and make edits' then return a text message asking the user to provide further context to generate or repopulate the Business Idea Canvas."""
        response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=f"This is the user message: {user_input}")])
        log_context('info', user_name, session_id, f"User indicated 'No' response, providing edit instructions")

    if user_input == "Yes, everything looks good":
        prompt = """You are a helpful assistant that check the user input. If user input is 'SATISFIED' or 'YES' or 'I AM SATISFIED' or 'Yes, everything looks good' then return a text message informing the user that you have recorded the information in the Business Idea Canvas. Ask user to provide further context to fill in missing fields or select a field to provide value for a particular field."""
        response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=f"This is the user message: {user_input}")])
        log_context('info', user_name, session_id, f"User indicated 'Yes' response, confirming canvas is satisfactory")
    return response.content if response else None

def additional_comments(user_name="system", session_id="default"):
    """
    Generates message for user after adding additional comments to BIC.
    
    Args:
        None
    
    Returns:
        str: The LLM's response content
    
    Exceptions:
        None
    """
    log_context('info', user_name, session_id, "Generating additional comments message")
    prompt = "You are a helpful assistant. Return a text message without emoticons informing user that you have added the additional comments in the Business Idea Canvas."
    response = llm.invoke([SystemMessage(content=prompt)])
    if response:
        log_context('info', user_name, session_id, "Successfully generated additional comments message")
        return response.content
    else:
        log_context('warn', user_name, session_id, "Failed to generate additional comments message, using default")
        return "Thanks for your input. I have added the additional comments to the canvas."