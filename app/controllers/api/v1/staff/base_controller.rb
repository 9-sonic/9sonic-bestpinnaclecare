module Api
  module V1
    module Staff
      # Base for carer (Employee) endpoints — requires a valid Employee JWT.
      class BaseController < ApplicationController
        before_action :authenticate_employee!

        private

        def current_identity = current_employee
      end
    end
  end
end
