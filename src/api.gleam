import gleam/erlang/process
import mist
import router
import wisp
import wisp/wisp_mist

pub fn main() {
  wisp.configure_logger()

  // I'll stop regenerating it once I know what it's for
  let secret_key_base = wisp.random_string(64)

  let assert Ok(_) =
    wisp_mist.handler(router.handle_request, secret_key_base)
    |> mist.new
    |> mist.port(8000)
    |> mist.start

  process.sleep_forever()
}
