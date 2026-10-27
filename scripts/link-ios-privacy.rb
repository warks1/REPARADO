#!/usr/bin/env ruby
# REPARADO V47: enlazar PrivacyInfo.xcprivacy al target App de Xcode.
# Ejecutar DESPUÉS de "npx cap add ios" y de instalar el manifiesto.
# Requiere la gema xcodeproj incluida con CocoaPods de los runners macOS.
begin
  require 'xcodeproj'
rescue LoadError
  abort 'Falta la gema xcodeproj: instalar CocoaPods/xcodeproj en macOS.'
end
require 'pathname'
root = Pathname.new(File.expand_path('..', __dir__))
project_file = root.join('ios/App/App.xcodeproj')
manifest_file = root.join('ios/App/App/PrivacyInfo.xcprivacy')
abort 'Falta el proyecto Xcode generado.' unless project_file.exist?
abort 'Falta PrivacyInfo.xcprivacy generado.' unless manifest_file.file?

project = Xcodeproj::Project.open(project_file.to_s)
app_target = project.targets.find { |t| t.name == 'App' && t.respond_to?(:resources_build_phase) }
abort 'No existe el target App para enlazar el manifiesto.' unless app_target

group = project.main_group.find_subpath('App', false)
abort 'No se encontró el grupo App de Xcode.' unless group

file = group.files.find { |ref| ref.path == 'PrivacyInfo.xcprivacy' }
file ||= group.new_file('PrivacyInfo.xcprivacy')
if !app_target.resources_build_phase.files_references.include?(file)
  app_target.resources_build_phase.add_file_reference(file)
end
project.save
abort 'El manifiesto no figura en recursos del target.' unless
  app_target.resources_build_phase.files_references.include?(file)
puts 'Manifiesto enlazado al target App (Copy Bundle Resources).'
