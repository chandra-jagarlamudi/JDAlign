import os
from langgraph.graph import StateGraph, END
from backend.state import GraphState
from backend.nodes.critic import critic_node
from backend.nodes.writer import writer_node
from backend.nodes.auditor import auditor_node

def should_continue(state: GraphState):
    """
    Determines whether to loop back to the writer or end the process.
    """
    feedback = state.get("audit_feedback", "")
    iteration = state.get("iteration_count", 0)
    max_iters = int(os.getenv("MAX_ITERATIONS", 3))
    
    if "APPROVED" in feedback.upper():
        print("--- AUDIT APPROVED ---")
        return END
    
    if iteration >= max_iters:
        print(f"--- MAX ITERATIONS ({max_iters}) REACHED ---")
        return END
        
    print(f"--- REJECTED: Re-routing to Writer (Iteration {iteration}) ---")
    return "writer"

def create_engine():
    """
    Creates and compiles the LangGraph state machine.
    """
    workflow = StateGraph(GraphState)
    
    # Add Nodes
    workflow.add_node("critic", critic_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("auditor", auditor_node)
    
    # Define Edges
    workflow.set_entry_point("critic")
    workflow.add_edge("critic", "writer")
    workflow.add_edge("writer", "auditor")
    
    # Conditional Edge from Auditor
    workflow.add_conditional_edges(
        "auditor",
        should_continue,
        {
            "writer": "writer",
            END: END
        }
    )
    
    return workflow.compile()
