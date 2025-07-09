cmake_minimum_required(VERSION 3.16)

project(QuickAddressBook VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Quick Gui)

qt_standard_project_setup(REQUIRES 6.8)

qt_add_executable(appQuickAddressBook
    main.cpp
)

qt_add_qml_module(appQuickAddressBook
    URI QuickAddressBook
    VERSION 1.0
    QML_FILES
        Main.qml
        QuickAddressBookTypes/AddressBookItem.qml
        QuickAddressBookTypes/NewAddressPopup.qml
)

set_target_properties(appQuickAddressBook PROPERTIES
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

target_link_libraries(appQuickAddressBook
    PRIVATE Qt6::Gui Qt6::Quick
)

include(GNUInstallDirs)
install(TARGETS appQuickAddressBook
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
