<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\PelayananController;
use App\Http\Controllers\Admin\PersyaratanController;
use App\Http\Controllers\Admin\PengajuanController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\Auth\LoginController;


Route::get('/', [PublicController::class, 'home']);

Route::get('/pelayanan', [PublicController::class, 'pelayanan']);

Route::get('/persyaratan/{id}', [PublicController::class, 'persyaratan']);

Route::get('/pengajuan', [PublicController::class, 'form']);

Route::post('/pengajuan', [PublicController::class, 'simpan']);

Route::get('/status', [PublicController::class, 'status']);


Route::prefix('admin')->group(function () {

    Route::get('/login', [LoginController::class, 'loginForm'])->name('login');
    Route::post('/login', [LoginController::class, 'login'])->name('login.submit');
    Route::get('/logout', [LoginController::class, 'logout'])->name('logout');

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::resource('/pelayanan', PelayananController::class);

    Route::resource('/persyaratan', PersyaratanController::class);

    Route::resource('/pengajuan', PengajuanController::class);

});