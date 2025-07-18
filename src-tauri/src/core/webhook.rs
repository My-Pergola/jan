use std::collections::VecDeque;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;

use hyper::{service::{make_service_fn, service_fn}, Body, Method, Request, Response, Server};
use serde_json::Value;
use tauri::{AppHandle, State};
use tokio::{sync::Mutex, task::JoinHandle};

use crate::core::state::{AppState, ServerHandle};

async fn handle_request(
    req: Request<Body>,
    queue: Arc<Mutex<VecDeque<Value>>>,
) -> Result<Response<Body>, Infallible> {
    if req.method() != Method::POST {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }

    let bytes = hyper::body::to_bytes(req.into_body()).await.unwrap_or_default();
    if let Ok(json) = serde_json::from_slice::<Value>(&bytes) {
        let leads = if let Some(arr) = json.as_array() {
            arr.clone()
        } else if let Some(obj) = json.as_object() {
            obj.get("leads")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default()
        } else {
            Vec::new()
        };

        let mut q = queue.lock().await;
        for lead in leads {
            q.push_back(lead);
        }
    }

    Ok(Response::new(Body::from("ok")))
}

async fn run_server(
    addr: SocketAddr,
    queue: Arc<Mutex<VecDeque<Value>>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let make_svc = make_service_fn(move |_| {
        let q = queue.clone();
        async move { Ok::<_, Infallible>(service_fn(move |req| handle_request(req, q.clone()))) }
    });

    let server = Server::bind(&addr).serve(make_svc);
    log::info!("Webhook server listening on http://{}", addr);
    server.await.map_err(|e| e.into())
}

#[tauri::command]
pub async fn start_webhook_server(state: State<'_, AppState>, port: u16) -> Result<(), String> {
    let addr: SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;

    let queue = state.webhook_queue.clone();
    let handle = tokio::spawn(run_server(addr, queue));
    let mut h = state.webhook_handle.lock().await;
    *h = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_webhook_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut handle = state.webhook_handle.lock().await;
    if let Some(h) = handle.take() {
        h.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_next_lead(state: State<'_, AppState>) -> Option<String> {
    let mut q = state.webhook_queue.lock().await;
    q.pop_front().map(|v| v.to_string())
}

