import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Calendar API" })
@TypeSpec.OpenAPI.info(#{ version: "0.1.0" })
namespace Calendar;

model Health {
  status: "ok";
}

@route("/api/health")
@tag("Health")
@get
op getHealth(): Health;
