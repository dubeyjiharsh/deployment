# Import standard Python libraries
import os
import uuid
import logging
from datetime import datetime, timezone

# Azure Storage SDK imports
from azure.data.tables import TableServiceClient, TableClient
from azure.core.credentials import AzureNamedKeyCredential
from azure.core.pipeline.transport import RequestsTransport

# Environment configuration
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Proxy Configurations (Optional / Set here if required)
# os.environ["HTTP_PROXY"] = os.getenv("HTTP_PROXY")
# os.environ["HTTPS_PROXY"] = os.getenv("HTTPS_PROXY")
# os.environ["SSL_CERT_FILE"] = os.getenv("SSL_CERT_FILE")
# os.environ["NO_PROXY"] = os.getenv("NO_PROXY")

# Azure Table Storage configuration
AZURE_STORAGE_TABLE_01_ENDPOINT = os.getenv("AZURE_STORAGE_TABLE_01_ENDPOINT")
AZURE_STORAGE_TABLE_01_NAME = os.getenv("AZURE_STORAGE_TABLE_01_NAME") 
AZURE_STORAGE_TABLE_01_KEY = os.getenv("AZURE_STORAGE_TABLE_01_KEY")
ADACHATLOG_TABLE_NAME = os.getenv("ADACHATLOG_TABLE_NAME")

# Initialize logger
logger = logging.getLogger("business_canvas")
logger.setLevel(logging.INFO)

# Set up basic console handler for development
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(console_handler)

# Custom logging handler for Azure Table Storage
class AzureTableLogHandler(logging.Handler):
    """
    A custom logging handler that stores log entries in Azure Table Storage.
    
    Args:
        table_client (azure.data.tables.TableClient): An authenticated Azure Table 
            Storage client instance that will be used to insert log records.
    
    Returns:
        None
    """
    def __init__(self, table_client):
        super().__init__()
        self.table_client = table_client  # Pass the table_client to insert logs into

    def emit(self, record):
        try:
            log_entry = self.format(record)
            # Extract user and session info from the log message
            user_name = record.user_name if hasattr(record, 'user_name') else "Unknown"
            session_id = record.session_id if hasattr(record, 'session_id') else "Unknown"
            
            # Generate timestamp with millisecond precision for RowKey
            timestamp_ms = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")[:-3]
            # Add a UUID to ensure uniqueness even if multiple logs happen at the same millisecond
            unique_id = str(uuid.uuid4()).replace('-', '')[:12]  # Using part of a UUID for uniqueness
            row_key = f"{session_id}_{timestamp_ms}_{unique_id}"
            
            # Format the timestamp ourselves since LogRecord doesn't have asctime attribute
            timestamp = datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]
            
            # Create log data for Azure Table Storage
            log_data = {
                'PartitionKey': user_name,
                'RowKey': row_key,
                'Timestamp': timestamp,
                'UserName': user_name,
                'SessionID': session_id,
                'Level': record.levelname,
                'LogMessage': log_entry
            }
            
            # Insert log data into Azure Table Storage
            self.table_client.create_entity(entity=log_data)
        except Exception as e:
            # In case of error, log it to the standard output
            print(f"Failed to log to Azure Table Storage: {e}")

# Context-aware logging function
def log_context(level, user_name, session_id, message):
    """
    Log with user and session context information in sentence format.
    
    Args:
        level (str): The logging level to use. Valid values are 'info', 'error', 
                    'warning', and 'debug'. If an invalid level is provided, 
                    defaults to 'info'.
        user_name (str): The username to associate with this log entry. Used as 
                        the PartitionKey in Azure Table Storage.
        session_id (str): A unique identifier for the user's session. Used as 
                        part of the RowKey in Azure Table Storage.
        message (str): The message to log. Will be formatted as a sentence with 
                      a period added at the end if not already present.
    
    Returns:
        None
    
    Note:
        This function adds user_name and session_id as extra attributes to the
        LogRecord, which are used by AzureTableLogHandler to properly structure
        the data in Azure Table Storage.
    """

    # Extra dictionary for structured logging
    extra = {'user_name': user_name, 'session_id': session_id}
    # Format the log message as a complete sentence
    formatted_message = f"{message}."  
    # Log with appropriate level
    if level == 'info':
        logger.info(formatted_message, extra=extra)
    elif level == 'error':
        logger.error(formatted_message, extra=extra)
    elif level == 'warning':
        logger.warning(formatted_message, extra=extra)
    elif level == 'debug':
        logger.debug(formatted_message, extra=extra)
    else:
        logger.info(formatted_message, extra=extra)

# Function to create the TableServiceClient and log the event
def create_table_client():
    """
    Creates and returns an Azure Table service client.
    Checks if the table exists before creating it.
    Also logs events when a table is created or if an error occurs.
    
    Returns:
        TableClient: Initialized Azure Table client for the specific table
    """
    try:
        # Create the service client with authentication
        adachatlog_credential = AzureNamedKeyCredential(AZURE_STORAGE_TABLE_01_NAME, AZURE_STORAGE_TABLE_01_KEY)
        adachatlog_service_client = TableServiceClient(endpoint=AZURE_STORAGE_TABLE_01_ENDPOINT, credential=adachatlog_credential)

        # Log the service client creation event
        log_context('info', 'system', 'table-setup', "Successfully created TableServiceClient.")

        # Check if the table exists by listing all tables and checking
        table_exists = False
        try:
            # Get a list of all tables in the account
            tables = list(adachatlog_service_client.list_tables())
            table_exists = any(table.name == ADACHATLOG_TABLE_NAME for table in tables)
            
            if table_exists:
                log_context('info', 'system', 'table-setup', f"Table {ADACHATLOG_TABLE_NAME} already exists.")
            else:
                log_context('info', 'system', 'table-setup', f"Table {ADACHATLOG_TABLE_NAME} does not exist.")
        except Exception as table_error:
            # Error checking table existence
            log_context('error', 'system', 'table-setup', f"Error checking if table {ADACHATLOG_TABLE_NAME} exists: {str(table_error)}")
            table_exists = False

        # Create the table if it doesn't exist
        if not table_exists:
            try:
                adachatlog_service_client.create_table(ADACHATLOG_TABLE_NAME)
                logger.info(f"Successfully created table: {ADACHATLOG_TABLE_NAME}.")
                log_context('info', 'system', 'table-setup', f"Successfully created table: {ADACHATLOG_TABLE_NAME}.")
            except Exception as create_error:
                # Handle case where table might have been created by another process
                if "TableAlreadyExists" in str(create_error):
                    log_context('info', 'system', 'table-setup', f"Table {ADACHATLOG_TABLE_NAME} was created by another process.")
                else:
                    # Re-raise other errors
                    raise create_error
        
        # Get the table client for the table
        adachatlog_table_client = adachatlog_service_client.get_table_client(ADACHATLOG_TABLE_NAME)
        
        return adachatlog_table_client
    except Exception as e:
        error_msg = f"Failed to create table client or table: {str(e)}"
        log_context('error', 'system', 'table-setup', error_msg)
        raise ValueError(error_msg)

# Initialize table client and logger
adachatlog_table_client = None
azure_handler = None

def initialize_logging():
    """
    Initialize Azure Table Storage logging.
    
    This function sets up the logging system to use Azure Table Storage
    for log persistence. It creates a table client, configures a custom
    handler, and adds it to the global logger.
    
    Args:
        None
    
    Returns:
        bool: True if initialization was successful, False otherwise.
    
    Raises:
        Exception: The function handles all exceptions internally and 
                  logs them using the log_context function.
    
    Global Variables:
        adachatlog_table_client: The Azure Table client that gets initialized.
        azure_handler: The custom logging handler that gets created.
        logger: The global logger that's being configured.
    """
    global adachatlog_table_client, azure_handler
    try:
        # Create the Azure Table client and pass it to the custom logger
        adachatlog_table_client = create_table_client()

        # Add the custom Azure Table handler to the logger
        azure_handler = AzureTableLogHandler(adachatlog_table_client)
        azure_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(azure_handler)
        
        # Log successful initialization
        log_context('info', 'system', 'logging-setup', "Azure Table Storage logging initialized successfully")
        
        return True
    except Exception as e:
        log_context('error', 'system', 'logging-setup', f"Error initializing Azure Table Storage logging: {str(e)}")
        return False

def get_logger():
    """
    Get the configured logger.
    
    Returns a reference to the global logger that has been configured 
    with appropriate handlers, including the Azure Table Storage handler
    if initialize_logging() has been called successfully.
    
    Args:
        None
    
    Returns:
        logging.Logger: The configured logger instance.
    
    Note:
        This function should be called after initialize_logging() has
        been called to ensure the logger is properly configured.
    """
    return logger

# Initialize logging when the module is imported
is_initialized = initialize_logging()
if not is_initialized:
    logger.warning("Azure Table Storage logging could not be initialized. Falling back to console logging only.")