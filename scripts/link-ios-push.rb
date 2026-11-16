#!/usr/bin/env ruby
# REPARADO V113: enlaza App.entitlements (Push Notifications) al target App.
# Ejecutar DESPUÉS de scripts/configure-ios-push.py y 'npx cap add ios'.
begin
  require 'xcodeproj'
rescue LoadError
  abort 'Falta la gema xcodeproj: instalar CocoaPods/xcodeproj en macOS.'
end
require 'pathname'
root = Pathname.new(File.expand_path('..', __dir__))
project_file = root.join('ios/App/App.xcodeproj')
abort 'Falta el proyecto Xcode generado.' unless project_file.exist?
abort 'Falta App.entitlements generado.' unless root.join('ios/App/App/App.entitlements').file?
project = Xcodeproj::Project.open(project_file.to_s)
target = project.targets.find { |t| t.name == 'App' }
abort 'No existe el target App.' unless target
group = project.main_group.find_subpath('App', false)
abort 'No se encontró el grupo App de Xcode.' unless group
group.files.find { |r| r.path == 'App.entitlements' } || group.new_file('App.entitlements')
target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end
project.save
ok = target.build_configurations.all? { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] == 'App/App.entitlements' }
abort 'Los entitlements no quedaron enlazados.' unless ok
puts 'Push Notifications enlazado al target App.'
