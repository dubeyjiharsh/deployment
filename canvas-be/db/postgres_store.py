import json
import uuid
from typing import Dict, Any, List, Optional
from utils.db_utils import get_db_connection, get_db_cursor
 
class PostgresStore:
    """PostgreSQL storage for canvas sessions"""
 
    def __init__(self):
        pass
    # ==================== CANVAS TABLE OPERATIONS ====================
    
    def create_canvas(
        self,
        user_id: str,
        name: str = "Untitled Canvas",
        status: str = "created"
    ) -> str:
        """
        Create a new canvas record
        
        Args:
            user_id: The user identifier
            thread_id: Azure OpenAI thread ID
            assistant_id: Azure OpenAI assistant ID
            name: Canvas name
            status: Canvas status (default: 'created')
        
        Returns:
            canvas_id (UUID as string)
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        
        try:
            canvas_id = str(uuid.uuid4())
            conversation_metadata = {"user_id": user_id}
            
            cur.execute(
                """
                INSERT INTO canvas (
                    canvas_id, name, status,
                    file_ids, conversation_metadata
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING canvas_id
                """,
                (
                    canvas_id,
                    name,
                    status,
                    [],  # empty file_ids array
                    json.dumps(conversation_metadata)  # empty conversation_metadata
                )
            )
            
            conn.commit()
            return canvas_id
        
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to create canvas: {str(e)}")
        finally:
            cur.close()
            conn.close()

    def update_canvas(self, canvas_id: str, new_name: str, thread_id: str=None) -> bool:
        """
        Update the name (title) of a canvas in the canvas table
        Args:
            canvas_id: Canvas UUID
            new_name: New title for the canvas
            thread_id: Azure OpenAI previous response ID
        Returns:
            True if successful
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        try:
            cur.execute(
                """
                UPDATE canvas
                SET name = %s,
                thread_id = %s
                WHERE canvas_id = %s
                """,
                (new_name, thread_id, canvas_id)
            )
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to update canvas name: {str(e)}")
        finally:
            cur.close()
            conn.close()
    
    def get_canvas(self, canvas_id: str) -> Optional[Dict[str, Any]]:
        """
        Get canvas by ID
        
        Args:
            canvas_id: Canvas UUID
        
        Returns:
            Canvas record as dictionary or None if not found
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn, dict_cursor=True)
        
        try:
            cur.execute(
                """
                SELECT canvas_id, name, status, assistant_id, thread_id,
                       file_ids, conversation_metadata, created_at, updated_at
                FROM canvas
                WHERE canvas_id = %s
                """,
                (canvas_id,)
            )
            
            result = cur.fetchone()
            return dict(result) if result else None
        
        finally:
            cur.close()
            conn.close()
    
    def get_all_canvases(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all canvas records

        Args: 
            user_id: The user identifier
        
        Returns:
            List of canvas records
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn, dict_cursor=True)
        
        try:
            cur.execute(
                """
                SELECT c.canvas_id, c.name, c.status, c.thread_id, c.created_at, c.updated_at, cf.problem_statement
                FROM canvas c
                INNER JOIN canvas_fields cf ON c.canvas_id = cf.canvas_id 
                WHERE c.conversation_metadata->>'user_id' = %s AND c.status IN %s   
                ORDER BY c.created_at DESC
                """,
                (user_id, ('drafted',))
            )
            
            results = cur.fetchall()
            return [dict(row) for row in results]
        
        finally:
            cur.close()
            conn.close()
    
    def add_file_to_canvas(self, canvas_id: str, file_id: str) -> bool:
        """
        Add a file ID to canvas
        
        Args:
            canvas_id: Canvas UUID
            file_id: Azure OpenAI file ID
        
        Returns:
            True if successful
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        
        try:
            cur.execute(
                """
                UPDATE canvas
                SET file_ids = array_append(file_ids, %s)
                WHERE canvas_id = %s
                """,
                (file_id, canvas_id)
            )
            
            conn.commit()
            return cur.rowcount > 0
        
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to add file to canvas: {str(e)}")
        finally:
            cur.close()
            conn.close()

    def update_status(self, canvas_id: str, action: str='drafted') -> None:
        """
        Update the status of a canvas from 'created' to 'drafted' using canvas_id
        Args:
            canvas_id: Canvas UUID
        Returns:
            None
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        try:
            cur.execute(
                """
                UPDATE canvas
                SET status = %s
                WHERE canvas_id = %s
                """,
                (action, canvas_id)
            )
            conn.commit()
            # return cur.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to update canvas status: {str(e)}")
        finally:
            cur.close()
            conn.close()
 
    def delete_canvas(self, canvas_id: str) -> bool:
        """
        Delete canvas and its fields
        
        Args:
            canvas_id: Canvas UUID
        
        Returns:
            True if successful
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        
        try:
            # Delete canvas_fields first (foreign key constraint)
            cur.execute("DELETE FROM canvas_fields WHERE canvas_id = %s", (canvas_id,))
            
            # Delete canvas
            cur.execute("DELETE FROM canvas WHERE canvas_id = %s", (canvas_id,))
            
            conn.commit()
            return cur.rowcount > 0
        
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to delete canvas: {str(e)}")
        finally:
            cur.close()
            conn.close()
    
    # ==================== CANVAS_FIELDS TABLE OPERATIONS ====================
    
    def upsert_canvas_fields(self, canvas_id: str, canvas_data: Dict[str, Any]) -> str:
        """
        Insert or update canvas fields
        
        Args:
            canvas_id: Canvas UUID
            canvas_data: Business Model Canvas JSON data
        
        Returns:
            field_id (UUID as string)
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        
        try:
            # Helper functions for type conversion
            def to_array(val):
                """Convert value to PostgreSQL array format (text[])."""
                if isinstance(val, list):
                    return [str(x) for x in val]
                elif val is not None:
                    return [str(val)]
                else:
                    return []

            def dict_list_to_text_array(val):
                """Convert list of dicts to text[] as readable JSON strings or summaries."""
                if isinstance(val, list):
                    return [json.dumps(x, ensure_ascii=False) if isinstance(x, dict) else str(x) for x in val]
                return []

            def to_jsonb(val):
                """Convert value to JSONB format"""
                if val is None:
                    return json.dumps({})
                return json.dumps(val) if not isinstance(val, str) else val

            def flatten_nfr(nfr_dict):
                if not isinstance(nfr_dict, dict):
                    return []
                result = []
                for k, v in nfr_dict.items():
                    if isinstance(v, list):
                        for item in v:
                            result.append(f"{k}: {item}")
                    else:
                        result.append(f"{k}: {v}")
                return result

            # Map canvas data to database fields, serializing as needed
            fields = {
                "canvas_id": canvas_id,
                "title": canvas_data.get("Title", "Untitled"),
                "problem_statement": canvas_data.get("Problem Statement"),
                "objectives": to_array(canvas_data.get("Objectives")),
                "kpis": dict_list_to_text_array(canvas_data.get("KPIs")),
                "success_criteria": to_array(canvas_data.get("Success Criteria")),
                "key_features": dict_list_to_text_array(canvas_data.get("Key Features")),
                "relevant_facts": to_array(canvas_data.get("Relevant Facts", [])),
                "risks": dict_list_to_text_array(canvas_data.get("Risks")),
                "assumptions": to_array(canvas_data.get("Assumptions")),
                # Convert Non Functional Requirements dict to flat list of strings for TEXT[] column
                "non_functional_requirements": to_jsonb(canvas_data.get("Non Functional Requirements")),
                "use_cases": dict_list_to_text_array(canvas_data.get("Use Cases")),
                "governance": to_jsonb(canvas_data.get("Governance", [])),
                "tags": to_array(canvas_data.get("Tags", []))
            }
            
            # Check if canvas_fields already exists
            cur.execute(
                "SELECT id FROM canvas_fields WHERE canvas_id = %s",
                (canvas_id,)
            )
            existing = cur.fetchone()
            
            if existing:
                # Update existing record
                cur.execute(
                    """
                    UPDATE canvas_fields
                    SET title = %(title)s,
                        problem_statement = %(problem_statement)s,
                        objectives = %(objectives)s,
                        kpis = %(kpis)s,
                        success_criteria = %(success_criteria)s,
                        key_features = %(key_features)s,
                        relevant_facts = %(relevant_facts)s,
                        risks = %(risks)s,
                        assumptions = %(assumptions)s,
                        non_functional_requirements = %(non_functional_requirements)s,
                        use_cases = %(use_cases)s,
                        governance = %(governance)s,
                        tags = %(tags)s
                    WHERE canvas_id = %(canvas_id)s
                    RETURNING id
                    """,
                    fields
                )
            else:
                # Insert new record
                cur.execute(
                    """
                    INSERT INTO canvas_fields (
                        canvas_id, title, problem_statement, objectives, kpis,
                        success_criteria, key_features, relevant_facts, risks,
                        assumptions, non_functional_requirements, use_cases,
                        governance, tags
                    )
                    VALUES (
                        %(canvas_id)s, %(title)s, %(problem_statement)s, %(objectives)s,
                        %(kpis)s, %(success_criteria)s, %(key_features)s, %(relevant_facts)s,
                        %(risks)s, %(assumptions)s, %(non_functional_requirements)s,
                        %(use_cases)s, %(governance)s, %(tags)s
                    )
                    RETURNING id
                    """,
                    fields
                )
            
            field_id = cur.fetchone()[0]
            conn.commit()
            return str(field_id)
        
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to upsert canvas fields: {str(e)}")
        finally:
            cur.close()
            conn.close()
    
    def get_canvas_fields(self, canvas_id: str) -> Optional[Dict[str, Any]]:
        """
        Get canvas fields by canvas_id
        
        Args:
            canvas_id: Canvas UUID
        
        Returns:
            Canvas fields as dictionary or None
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn, dict_cursor=True)
        
        try:
            cur.execute(
                """
                SELECT id, canvas_id, title, problem_statement, objectives, kpis,
                       success_criteria, key_features, relevant_facts, risks,
                       assumptions, non_functional_requirements, use_cases,
                       governance, tags, created_at, updated_at
                FROM canvas_fields
                WHERE canvas_id = %s
                """,
                (canvas_id,)
            )
            
            result = cur.fetchone()
            return dict(result) if result else None
        
        finally:
            cur.close()
            conn.close()
    
    def canvas_exists(self, canvas_id: str) -> bool:
        """
        Check if canvas exists
        
        Args:
            canvas_id: Canvas UUID
        
        Returns:
            True if exists
        """
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        
        try:
            cur.execute(
                "SELECT 1 FROM canvas WHERE canvas_id = %s",
                (canvas_id,)
            )
            return cur.fetchone() is not None
        finally:
            cur.close()
            conn.close()
 
# Global instance
postgres_store = PostgresStore()