<!DOCTYPE html>
<html>

<head>

    <title>Admin Panel</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

</head>

<body>

    <nav class="navbar navbar-dark bg-dark">

        <div class="container">

            <a class="navbar-brand">Admin Pelayanan</a>

            <a href="/admin/logout" class="btn btn-danger">
                Logout
            </a>

        </div>

    </nav>

    <div class="container mt-4">

        <div class="row">

            <div class="col-md-3">

                <div class="list-group">

                    <a href="/admin/dashboard" class="list-group-item">
                        Dashboard
                    </a>

                    <a href="/admin/pelayanan" class="list-group-item">
                        Pelayanan
                    </a>

                    <a href="/admin/persyaratan" class="list-group-item">
                        Persyaratan
                    </a>

                    <a href="/admin/pengajuan" class="list-group-item">
                        Pengajuan
                    </a>

                </div>

            </div>

            <div class="col-md-9">

                @yield('content')

            </div>

        </div>

    </div>

</body>

</html>