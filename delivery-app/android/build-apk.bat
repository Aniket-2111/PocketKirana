@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "d:\pocketkirana\delivery-app\android"
call gradlew.bat assembleDebug
