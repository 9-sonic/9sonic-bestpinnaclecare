module Api
  module V1
    module Admin
      # Base for office (Admin) endpoints — requires a valid Admin JWT.
      class BaseController < ApplicationController
        before_action :authenticate_admin!

        private

        def current_identity = current_admin
      end
    end
  end
end
