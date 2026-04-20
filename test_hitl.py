import uuid
import os
from dotenv import load_dotenv
from backend.engine import create_engine

load_dotenv()

def test_hitl():
    # Force local Ollama URL and correct model for testing
    os.environ["LLM_BASE_URL"] = "http://localhost:11434"
    os.environ["LLM_MODEL"] = "ollama/qwen3:8b-q4_K_M"
    
    engine = create_engine()
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    sample_resume = "John Doe, Python Developer. Experience with Django."
    sample_jd = "Senior Python Developer. Need experience with AWS and Kubernetes."
    
    initial_state = {
        "original_resume": sample_resume,
        "job_description": sample_jd,
        "analysis_report": [],
        "draft_bullets": [],
        "audit_feedback": None,
        "iteration_count": 0,
        "user_approved": None,
    }
    
    print(f"--- Starting Thread: {thread_id} ---")
    
    # First pass: Run until interrupt
    for chunk in engine.stream(initial_state, config, stream_mode="updates"):
        print(f"Chunk: {chunk}")
        
    state = engine.get_state(config)
    print(f"State after first pass: next={state.next}")
    print(f"Tasks after first pass: {state.tasks}")
    print(f"Analysis Report: {state.values.get('analysis_report')}")
    
    # In some versions of LangGraph, next might be empty during an interrupt 
    # if it's at the very end of the node but before the edge evaluation.
    # But usually interrupt_after should stop BEFORE the next node is determined.
    
    # We simulate a "waiting" check similar to the API
    if not state.next and not any(task.name == '__interrupt__' for task in state.tasks):
         # Try to see if we can continue anyway
         pass

    # Simulate user approval
    print("\n--- Simulating User Approval ---")
    engine.update_state(config, {"user_approved": True})
    
    # Second pass: Continue
    for chunk in engine.stream(None, config, stream_mode="updates"):
        print(f"Chunk: {chunk}")
        
    state = engine.get_state(config)
    print(f"Final State: next={state.next}")
    print(f"Draft Bullets: {state.values.get('draft_bullets')}")
    print(f"Audit Feedback: {state.values.get('audit_feedback')}")

if __name__ == "__main__":
    test_hitl()
