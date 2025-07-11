cmake_minimum_required(VERSION 3.19)

# Resolve version from top-level package.json
file(READ ${CMAKE_CURRENT_SOURCE_DIR}/../qt-core/package.json PACKAGE_JSON)
string(JSON VSCODEEXT_VERSION GET ${PACKAGE_JSON} version)

project(vscodeextDoc VERSION "${VSCODEEXT_VERSION}")

if(QT_BUILD_ONLINE_DOCS)
    set(DOC_CONF "online/vscodeext.qdocconf")
else()
    set(DOC_CONF "vscodeext.qdocconf")
endif()

find_package(Qt6 COMPONENTS ToolsTools HostInfo QUIET)
if (Qt6_FOUND)
    get_target_property(QDOC_EXEC Qt6::qdoc IMPORTED_LOCATION)
   # QT_INSTALL_DOCS contains Qt documentation templates
    set(QT_INSTALL_DOCS "${Qt6_DIR}/../../../doc")
else()
    message(FATAL_ERROR "Failed to find QDoc.")
endif()

add_custom_target(html_docs
    COMMAND ${CMAKE_COMMAND} -E env
        "VSCODEEXT_VERSION=${PROJECT_VERSION}" "QT_VERSION=${VSCODEEXT_VERSION}"
        "VSCODEEXT_VER=${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}"
        "QT_VER=${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}"
        "VSCODEEXT_VERSION_TAG=${PROJECT_VERSION_MAJOR}${PROJECT_VERSION_MINOR}${PROJECT_VERSION_PATCH}"
        "QT_INSTALL_DOCS=${QT_INSTALL_DOCS}"
        "BUILDDIR=${CMAKE_SOURCE_DIR}"
        ${QDOC_EXEC} --indexdir ${QT_INSTALL_DOCS} --outputdir ${CMAKE_CURRENT_BINARY_DIR}/html ${DOC_CONF}
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
)
