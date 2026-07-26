module Api
  module V1
    # Base for endpoints either identity can call. The bearer token's scope
    # decides who current_identity is (Admin or Employee).
    class SharedController < ApplicationController
      before_action :authenticate_identity!

      private

      def current_identity
        @current_identity ||= current_admin || current_employee
      end

      def authenticate_identity!
        render json: { error: "unauthorized" }, status: :unauthorized unless current_identity
      end
    end
  end
end
