<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pengajuan extends Model
{
    protected $fillable = [
        'nama',
        'nik',
        'alamat',
        'no_hp',
        'pelayanan_id',
        'tanggal_pengajuan',
        'status'
    ];

    public function pelayanan()
    {
        return $this->belongsTo(Pelayanan::class);
    }

    public function berkas()
    {
        return $this->hasOne(BerkasPengajuan::class);
    }
}
