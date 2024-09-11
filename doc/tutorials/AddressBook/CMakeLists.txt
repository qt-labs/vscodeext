cmake_minimum_required(VERSION 3.16)

project(AddressBook VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 REQUIRED COMPONENTS Widgets)
qt_standard_project_setup()

qt_add_executable(AddressBook
        main.cpp
        addressbook.cpp
        addressbook.h
        addressbook.ui
        adddialog.cpp
        adddialog.h
        adddialog.ui
)

target_link_libraries(AddressBook PRIVATE Qt6::Widgets)

set_target_properties(AddressBook PROPERTIES
    WIN32_EXECUTABLE ON
    MACOSX_BUNDLE ON
)
