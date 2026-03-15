<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BerkasPengajuan extends Model
{
    protected $fillable = [
        'pengajuan_id',
        'ktp',
        'kk',
        'berkas_lain'
    ];

    public function pengajuan()
    {
        return $this->belongsTo(Pengajuan::class);
    }
}