from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any
from engine import execute_algorithm 

app = FastAPI(title="NeuralCanvas ML Engine")


class ExecuteRequest(BaseModel):
    algorithm_type: str
    params: dict = {}
    input_data: dict = {}


@app.post("/execute")
def execute(request: ExecuteRequest):
    try:
        result = execute_algorithm(
            algorithm_type=request.algorithm_type,
            params=request.params,
            input_data=request.input_data
        )
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/algorithms")
def list_algorithms():
    from engine import ALGORITHM_REGISTRY, DL_ALGORITHMS
    return {
        "ml": list(ALGORITHM_REGISTRY.keys()),
        "dl": DL_ALGORITHMS
    }


@app.get("/health")
def health():
    return {"status": "ok"}