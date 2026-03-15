<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pelayanan extends Model
{
    protected $fillable = [
        'nama_pelayanan',
        'deskripsi'
    ];

    public function persyaratan()
    {
        return $this->hasMany(Persyaratan::class);
    }

    public function pengajuan()
    {
        return $this->hasMany(Pengajuan::class);
    }
}