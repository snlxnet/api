import gleam/http.{Get, Post}
import web
import wisp.{type Request, type Response}

pub fn handle_request(req: Request) -> Response {
  use req <- web.middleware(req)

  case wisp.path_segments(req) {
    [] -> home_redirect(req)
    ["update"] -> update(req)
    _ -> wisp.not_found()
  }
}

fn home_redirect(req: Request) -> Response {
  // The home page can only be accessed via GET requests, so this middleware is
  // used to return a 405: Method Not Allowed response for all other methods.
  use <- wisp.require_method(req, Get)

  wisp.redirect("https://github.com/snlxnet/api")
}

fn update(_req: Request) -> Response {
  echo "Update triggered"

  wisp.html_response("OK", 200)
}
