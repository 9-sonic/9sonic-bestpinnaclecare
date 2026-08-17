module Api
  module V1
    module Admin
      # Web Push config for the office app. Returns the VAPID PUBLIC key (public
      # by design) so the browser can subscribe, and whether push is enabled at
      # all — letting the client fetch the key at runtime instead of baking it
      # into the build, so it can rotate without a frontend rebuild.
      class PushController < BaseController
        # GET /api/v1/admin/push/config
        # NB: the action is `show`, not `config` — `config` is a reserved
        # ActionController method and overriding it recurses on render.
        def show
          cfg = Rails.configuration.web_push
          render json: { enabled: cfg.enabled, public_key: cfg.public_key }
        end
      end
    end
  end
end
