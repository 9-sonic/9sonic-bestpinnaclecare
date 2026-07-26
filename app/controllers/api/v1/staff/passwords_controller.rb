module Api
  module V1
    module Staff
      class PasswordsController < ApplicationController
        include PasswordManagement

        private

        def reset_resource_class = Employee
        def reset_scope = :staff
      end
    end
  end
end
