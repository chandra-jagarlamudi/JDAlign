import os
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from backend.state import GraphState
from backend.nodes.critic import critic_node
from backend.nodes.writer import writer_node
from backend.nodes.auditor import auditor_node

from backend.nodes.reconstructor import reconstructor_node

def decide_after_audit(state: GraphState):
    """
    Decide whether to loop back to writer or proceed to the final step.
    """
    feedback = state.get("audit_feedback", "")
    iteration = state.get("iteration_count", 0)
    max_iters = int(os.getenv("MAX_ITERATIONS", 3))
    
    # If not approved and we have iterations left, loop back to writer
    if "APPROVED" not in feedback.upper() and iteration < max_iters:
        print(f"--- REJECTED: Re-routing to Writer (Iteration {iteration}) ---")
        return "writer"
    
    # Otherwise, move to reconstructor (this is where we will interrupt)
    print("--- AUDIT FINISHED: Proceeding to user choice ---")
    return "reconstructor"

def create_engine():
    """
    Creates and compiles the LangGraph state machine with HITL.
    """
    workflow = StateGraph(GraphState)
    checkpointer = MemorySaver()
    
    # Add Nodes
    workflow.add_node("critic", critic_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("auditor", auditor_node)
    workflow.add_node("reconstructor", reconstructor_node)
    
    # Define Edges
    workflow.set_entry_point("critic")
    workflow.add_edge("critic", "writer")
    workflow.add_edge("writer", "auditor")
    
    # Conditional Edge from Auditor: Loop to writer OR go to reconstructor
    workflow.add_conditional_edges(
        "auditor",
        decide_after_audit,
        {
            "writer": "writer",
            "reconstructor": "reconstructor"
        }
    )
    
    workflow.add_edge("reconstructor", END)
    
    # INTERRUPT BEFORE reconstructor to ask the user if they want the full rewrite
    return workflow.compile(checkpointer=checkpointer, interrupt_before=["reconstructor"])
