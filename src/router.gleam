import gleam/http.{Get, Patch}
import gleam/result
import shellout
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

fn update(req: Request) -> Response {
  use <- wisp.require_method(req, Patch)
  let pwd = "."
  let _pull_ok = case
    shellout.command(run: "git", with: ["pull"], in: pwd, opt: [])
    |> result.try(fn(_) {
      shellout.command(
        run: "gleam",
        with: ["export", "erlang-shipment"],
        in: pwd,
        opt: [],
      )
    })
    |> result.try(fn(_) {
      shellout.command(
        run: "mprocs",
        with: ["--ctl", "{ c: restart-proc }"],
        in: pwd,
        opt: [],
      )
    })
  {
    Ok(_) -> wisp.json_response("{\"status\":\"OK\"}", 200)
    Error(err) -> {
      echo err
      wisp.internal_server_error()
    }
  }
}
