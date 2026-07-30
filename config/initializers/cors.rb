# CORS — allow the two frontends (admin web + carer PWA) to call the API, which
# is served on a different subdomain (api.bestpinnaclecare.co.uk). Origins come
# from CORS_ORIGINS (comma-separated) or fall back to the known hosts + localhost.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*(ENV["CORS_ORIGINS"].to_s.split(",").map(&:strip).reject(&:empty?).presence || %w[
      https://admin.bestpinnaclecare.co.uk
      https://carer.bestpinnaclecare.co.uk
      http://localhost:5173
      http://localhost:5174
    ]))

    resource "*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             expose:  %w[Authorization], # so the PWA can read the access token from the header
             max_age: 600
  end
end
