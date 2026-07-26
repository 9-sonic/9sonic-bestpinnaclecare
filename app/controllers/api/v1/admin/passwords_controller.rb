module Api
  module V1
    module Admin
      class PasswordsController < ApplicationController
        include PasswordManagement

        private

        def reset_resource_class = ::Admin
        def reset_scope = :admin
      end
    end
  end
end
