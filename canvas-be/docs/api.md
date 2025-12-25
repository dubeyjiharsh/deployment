# API Reference

## Overview

Base URL: `http://<host>:<port>`

This service exposes endpoints under the `/api/canvas` prefix for creating and managing Business Model Canvas sessions and for interacting with the chat/assistant that generates canvas content.

---

## Endpoints

- **POST /api/canvas/create**
  - **Description:** Create a new canvas session.
  - **Request:** No body required (server creates a new assistant/thread and persists a canvas record).
  - **Response (201/200):** `CreateCanvasResponse`
    - `canvas_id` (string)
    - `message` (string)
  - **Example:**
    ```bash
    curl -X POST http://<host>:<port>/api/canvas/create
    ```
  - **Errors:**
    - `500 Internal Server Error` — failed to create canvas session.
    - **Example response:**
      ```json
      {
        "error": "Internal Server Error",
        "detail": "Failed to create canvas session: <error message>"
      }
      ```

- **GET /api/canvas/list**
  - **Description:** Get a list of all canvas sessions.
  - **Response:** `CanvasListResponse`
    - `canvases`: list of objects with `canvas_id`, `created_at`, `thread_id`
  - **Example:**
    ```bash
    curl http://<host>:<port>/api/canvas/list
    ```
  - **Errors:**
    - `500 Internal Server Error` — server-side failure when querying canvases.
    - **Example response:**
      ```json
      {
        "error": "Internal Server Error",
        "detail": "Failed to retrieve canvas list: <error message>"
      }
      ```

- **GET /api/canvas/{canvas_id}/fields**
  - **Description:** Retrieve the Business Model Canvas fields for a canvas session.
  - **Path parameters:**
    - `canvas_id` (string) — canvas UUID
  - **Response:** JSON object containing either the `fields` data or a message indicating fields are not yet generated. Example responses:
    - If fields exist:
      ```json
      {
        "canvas_id": "<id>",
        "fields": { /* canvas JSON */ }
      }
      ```
    - If not generated yet:
      ```json
      {
        "canvas_id": "<id>",
        "message": "Canvas fields not yet generated. Send a message to generate the canvas.",
        "fields": null
      }
      ```
  - **Errors:** `404` if canvas not found.
  - **Errors:**
    - `404 Not Found` — when the requested canvas does not exist.
      - **Example response:**
        ```json
        {
          "error": "Not Found",
          "detail": "Canvas session not found"
        }
        ```
    - `500 Internal Server Error` — unexpected server error while fetching fields.
      - **Example response:**
        ```json
        {
          "error": "Internal Server Error",
          "detail": "Failed to retrieve canvas fields: <error message>"
        }
        ```
  - **Example:**
    ```bash
    curl http://<host>:<port>/api/canvas/<canvas_id>/fields
    ```

- **POST /api/canvas/{canvas_id}/message**
  - **Description:** Send a message (user prompt/problem statement) to the assistant for a given canvas session. The assistant responds with chat output and (optionally) an updated canvas JSON.
  - **Path parameters:** `canvas_id` (string)
  - **Request (multipart/form-data):**
    - `message` (form field, required): user's message text
    - `files` (file uploads, optional): one or more files to provide context
  - **Response:** `MessageResponse`
    - `canvas_id` (string)
    - `chat_response` (string)
    - `canvas_json` (object) — the generated/updated canvas structure
    - `conversation_history` (array of messages)
  - **Errors:**
    - `404 Not Found` — when the requested `canvas_id` does not exist.
      - **Example response:**
        ```json
        {
          "error": "Not Found",
          "detail": "Canvas session not found"
        }
        ```
    - `422 Unprocessable Entity` — when the assistant response cannot be parsed or validated.
      - **Example response:**
        ```json
        {
          "error": "Unprocessable Entity",
          "detail": "Failed to parse response: <error message>"
        }
        ```
    - `500 Internal Server Error` — unexpected server-side error while processing the message.
      - **Example response:**
        ```json
        {
          "error": "Internal Server Error",
          "detail": "Failed to process message: <error message>"
        }
        ```
  - **Example (simple message):**
    ```bash
    curl -X POST -F "message=Describe a lean startup business model for X" http://<host>:<port>/api/canvas/<canvas_id>/message
    ```
  - **Example (with file):**
    ```bash
    curl -X POST -F "message=See attached spec" -F "files[]=@spec.pdf" http://<host>:<port>/api/canvas/<canvas_id>/message
    ```

- **GET /api/canvas/{canvas_id}/history**
  - **Description:** Retrieve the full conversation history for a canvas session.
  - **Path parameters:** `canvas_id` (string)
  - **Response:** `ConversationHistoryResponse`
    - `canvas_id` (string)
    - `history` (array of conversation messages with `role` and `content`)
  - **Errors:** `404` if canvas not found.
  - **Errors:**
    - `404 Not Found` — when the requested `canvas_id` does not exist.
      - **Example response:**
        ```json
        {
          "error": "Not Found",
          "detail": "Canvas session not found"
        }
        ```
    - `500 Internal Server Error` — server error while retrieving conversation history.
      - **Example response:**
        ```json
        {
          "error": "Internal Server Error",
          "detail": "Failed to retrieve conversation history: <error message>"
        }
        ```
  - **Example:**
    ```bash
    curl http://<host>:<port>/api/canvas/<canvas_id>/history
    ```

---

## Response Models (summary)

The API uses Pydantic models defined in `models/schemas.py`. Key response shapes:

- `CreateCanvasResponse`:
  - `canvas_id` (string)
  - `message` (string)

- `MessageResponse`:
  - `canvas_id` (string)
  - `chat_response` (string)
  - `canvas_json` (object)
  - `conversation_history` (list of `{role, content}`)

- `ConversationHistoryResponse`:
  - `canvas_id` (string)
  - `history` (list of `{role, content}`)

- `CanvasListResponse`:
  - `canvases` (list of `{canvas_id, created_at, thread_id}`)

Refer to [models/schemas.py](models/schemas.py) for full model details.

---

## Common Errors

- `404 Not Found` — when the requested `canvas_id` does not exist.
- `422 Unprocessable Entity` — when incoming data cannot be parsed or validated.
- `500 Internal Server Error` — unexpected server-side errors.

## Notes & Implementation Details

- The API is implemented with FastAPI and registers two routers from `api/` with the shared prefix `/api/canvas`.
- Default server port: `8020` (see `main.py`).
- File uploads are handled as `multipart/form-data` in the `POST /{canvas_id}/message` endpoint; uploaded files are stored and associated with the canvas in the DB.

## Try it locally

Start the app (inside the project virtualenv):

```bash
python main.py <port>
```

Then use the curl examples above to exercise the APIs, or use FastAPI's interactive Swagger UI at `http://<host>:<port>/docs`.